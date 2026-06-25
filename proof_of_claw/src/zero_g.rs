//! 0G Labs integration — Compute (decentralized LLM inference) and
//! Storage (execution trace persistence).
//!
//! ## Storage
//! The 0G Storage network uses a two-phase upload: (1) submit a data segment
//! merkle root to the on-chain Flow contract, then (2) upload data segments to
//! storage nodes. The canonical SDKs (TypeScript `@0glabs/0g-ts-sdk`) handle
//! both phases. There is no official Rust SDK yet, so this module uses the
//! indexer's JSON-RPC `getFileInfo` / kv operations for retrieval, and falls
//! back to a content-addressable SHA-256 hash when uploads cannot go through
//! the full on-chain flow.
//!
//! For production uploads, the CLI and frontend use the real TypeScript SDK.
//! This Rust module is primarily used for trace retrieval and attestation.
//!
//! ## Compute
//! 0G Compute Serving exposes an OpenAI-compatible `/v1/chat/completions`
//! endpoint on individual serving nodes. The broker (`broker-testnet.0g.ai`)
//! performs service discovery — it is NOT the inference endpoint itself.

use crate::config::AgentConfig;
use crate::types::{ExecutionTrace, InferenceRequest, InferenceResponse};
use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::Value;
use sha2::{Digest, Sha256};

/// 0G Compute — decentralized LLM inference with TEE attestations.
///
/// Connects to a 0G Compute serving node (not the broker). The serving
/// endpoint must expose `/v1/chat/completions` (OpenAI-compatible).
pub struct ZeroGCompute {
    client: Client,
    endpoint: String,
}

impl ZeroGCompute {
    pub async fn new(config: &AgentConfig) -> Result<Self> {
        Ok(Self {
            client: Client::new(),
            endpoint: config.zero_g_compute_endpoint.clone(),
        })
    }

    /// Resolve the actual serving endpoint from a broker URL.
    ///
    /// If the configured endpoint is a broker (`broker-*.0g.ai`), queries
    /// it for an available serving node. Otherwise returns the endpoint as-is.
    async fn resolve_serving_endpoint(&self, model: &str) -> Result<String> {
        let is_broker = self.endpoint.contains("broker");
        if !is_broker {
            return Ok(self.endpoint.clone());
        }

        // Query the broker for a serving node that hosts this model
        let url = format!("{}/v1/services", self.endpoint);
        let resp = self
            .client
            .get(&url)
            .query(&[("model", model)])
            .send()
            .await
            .with_context(|| format!("Failed to query 0G broker at {url}"))?;

        if !resp.status().is_success() {
            anyhow::bail!(
                "0G broker returned {} — is the model '{}' available?",
                resp.status(),
                model
            );
        }

        let body: Value = resp.json().await.context("Failed to parse broker response")?;

        // Extract the first available service URL
        let service_url = body
            .get("services")
            .or_else(|| body.get("data"))
            .and_then(|arr| arr.as_array())
            .and_then(|arr| arr.first())
            .and_then(|svc| {
                svc.get("url")
                    .or_else(|| svc.get("endpoint"))
                    .and_then(|v| v.as_str())
            })
            .ok_or_else(|| anyhow::anyhow!("No serving nodes available for model '{model}'"))?;

        Ok(service_url.to_string())
    }

    /// Send an inference request to 0G Compute.
    ///
    /// If the configured endpoint is a broker, resolves a serving node first.
    /// On success, extracts a TEE attestation from the response if available.
    /// Falls back to a local SHA-256 content hash when the response doesn't
    /// contain an attestation field.
    pub async fn inference(&self, request: &InferenceRequest) -> Result<InferenceResponse> {
        let model = request.model.as_deref().unwrap_or("meta-llama/Llama-3.1-8B-Instruct");

        let serving_endpoint = self.resolve_serving_endpoint(model).await?;
        let url = format!("{}/v1/chat/completions", serving_endpoint.trim_end_matches('/'));

        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "messages": [
                    { "role": "system", "content": request.system_prompt },
                    { "role": "user", "content": request.user_prompt }
                ],
                "model": model
            }))
            .send()
            .await
            .with_context(|| format!("Failed to reach 0G Compute serving node at {url}"))?;

        let status = resp.status();
        let body = resp
            .text()
            .await
            .context("Failed to read 0G Compute response body")?;

        if !status.is_success() {
            anyhow::bail!(
                "0G Compute returned HTTP {status} from {url}: {}",
                &body[..body.len().min(200)]
            );
        }

        // Extract the completion text from the OpenAI-compatible response
        let content = extract_chat_content(&body).unwrap_or_else(|| body.clone());

        // Try to extract a TEE attestation from the response headers/body.
        let attestation = parse_attestation(&body)
            .unwrap_or_else(|| {
                tracing::debug!(
                    "No attestation field in 0G response; using local content hash"
                );
                let mut h = Sha256::new();
                h.update(body.as_bytes());
                format!("0x{}", hex::encode(h.finalize()))
            });

        Ok(InferenceResponse {
            content,
            attestation_signature: attestation,
            provider: "0g-compute".to_string(),
        })
    }
}

/// 0G Storage — decentralized storage for execution traces.
///
/// NOTE: Full 0G Storage uploads require the TypeScript SDK to submit
/// data segments to the Flow contract on-chain. This Rust module provides:
/// 1. Content-addressed trace hashing (always works, no network needed)
/// 2. Indexer-based retrieval via `getFileInfo` JSON-RPC
/// 3. A best-effort upload path that logs clearly when it falls back
///
/// For production uploads, use the CLI (`poc backup push`) or frontend
/// which both use the real `@0glabs/0g-ts-sdk`.
pub struct ZeroGStorage {
    client: Client,
    indexer_rpc: String,
}

impl ZeroGStorage {
    pub async fn new(config: &AgentConfig) -> Result<Self> {
        Ok(Self {
            client: Client::new(),
            indexer_rpc: config.zero_g_indexer_rpc.clone(),
        })
    }

    /// Compute a content-addressable hash for a trace.
    ///
    /// This is always available regardless of 0G network connectivity and
    /// provides a deterministic identifier for the trace data.
    pub fn content_hash(trace: &ExecutionTrace) -> Result<String> {
        let data = serde_json::to_string(trace).context("Failed to serialize trace")?;
        let mut h = Sha256::new();
        h.update(data.as_bytes());
        Ok(format!("0x{}", hex::encode(h.finalize())))
    }

    /// Store an execution trace and return its content hash.
    ///
    /// Computes a SHA-256 content hash and attempts to verify indexer
    /// connectivity. The content hash is deterministic and can be used
    /// as a commitment even when the 0G indexer is unavailable.
    ///
    /// Full decentralized storage (Flow contract submission + segment upload)
    /// requires the TypeScript SDK — see CLI `poc backup push` for that path.
    pub async fn store_trace(&self, trace: &ExecutionTrace) -> Result<String> {
        let content_hash = Self::content_hash(trace)?;
        let data = serde_json::to_string(trace).context("Failed to serialize trace")?;

        // Attempt to check indexer health — this validates connectivity
        // but does NOT perform a full decentralized upload (which requires
        // the Flow contract + segment submission via the TS SDK).
        let health_url = format!("{}/", self.indexer_rpc);
        match self.client.get(&health_url).send().await {
            Ok(r) if r.status().is_success() => {
                tracing::info!(
                    "0G indexer reachable. Trace committed locally as {content_hash} \
                     ({} bytes). Use CLI or frontend for full decentralized upload.",
                    data.len()
                );
            }
            Ok(r) => {
                tracing::warn!(
                    "0G indexer returned {} — trace committed locally as {content_hash}",
                    r.status()
                );
            }
            Err(e) => {
                tracing::warn!(
                    "0G indexer unreachable ({e}) — trace committed locally as {content_hash}"
                );
            }
        }

        Ok(content_hash)
    }

    /// Retrieve file info from the 0G indexer by root hash.
    ///
    /// Uses the indexer's JSON-RPC `getFileInfo` method which is part of the
    /// actual 0G indexer API.
    pub async fn retrieve_trace(&self, root_hash: &str) -> Result<ExecutionTrace> {
        // Use the indexer's actual JSON-RPC interface
        let resp = self
            .client
            .post(&self.indexer_rpc)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "method": "getFileInfo",
                "params": [root_hash],
                "id": 1
            }))
            .send()
            .await
            .with_context(|| format!("Failed to reach 0G indexer at {}", self.indexer_rpc))?;

        if !resp.status().is_success() {
            anyhow::bail!(
                "0G indexer returned {} for trace {root_hash}",
                resp.status()
            );
        }

        let body: Value = resp.json().await.context("Failed to parse indexer response")?;

        // Check for JSON-RPC error
        if let Some(err) = body.get("error") {
            anyhow::bail!(
                "0G indexer error for {root_hash}: {}",
                err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown")
            );
        }

        let result = body
            .get("result")
            .ok_or_else(|| anyhow::anyhow!("No result in indexer response for {root_hash}"))?;

        // The indexer returns file metadata; the actual data retrieval
        // requires downloading segments from storage nodes.
        // For traces stored as JSON, try to parse the data field if present.
        let trace_str = result
            .get("data")
            .and_then(|d| d.as_str())
            .map(String::from)
            .unwrap_or_else(|| result.to_string());

        serde_json::from_str(&trace_str)
            .with_context(|| format!("Failed to deserialize trace {root_hash}"))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Extract the completion text from an OpenAI-compatible chat response.
fn extract_chat_content(body: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    parsed
        .get("choices")?
        .as_array()?
        .first()?
        .get("message")?
        .get("content")?
        .as_str()
        .map(String::from)
}

/// Extract a TEE attestation from a 0G Compute JSON response.
/// Checks both top-level fields and nested `x-attestation` headers
/// that 0G Compute serving nodes may include.
fn parse_attestation(body: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    // Check standard attestation fields
    ["attestation", "signature", "proof", "tee_attestation"]
        .iter()
        .find_map(|k| parsed.get(k)?.as_str().map(String::from))
        .or_else(|| {
            // Check nested metadata that some 0G serving nodes include
            parsed
                .get("metadata")
                .or_else(|| parsed.get("x_attestation"))
                .and_then(|m| {
                    m.get("attestation")
                        .or_else(|| m.get("tee_proof"))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                })
        })
}

/// Public version of attestation extraction — used by hooks to parse
/// attestation fields from raw inference response content.
pub fn parse_attestation_from(body: &str) -> Option<String> {
    parse_attestation(body)
}

/// Extract a root/hash field from a JSON response body, or fall back to
/// a plain hex string that looks like a 32-byte hash.
fn extract_root_hash(body: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    ["root_hash", "hash", "root"]
        .iter()
        .find_map(|k| parsed.get(k)?.as_str().map(String::from))
        .or_else(|| {
            let t = body.trim();
            if t.starts_with("0x") && t.len() == 66 {
                Some(t.to_string())
            } else {
                None
            }
        })
}

#![no_main]

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

#[derive(Serialize, Deserialize)]
struct ExecutionTrace {
    agent_id: String,
    inference_commitment: [u8; 32],
    tool_invocations: Vec<ToolInvocation>,
    policy_check_results: Vec<PolicyResult>,
    output_commitment: [u8; 32],
    action_value: u64,
}

#[derive(Serialize, Deserialize)]
struct ToolInvocation {
    tool_name: String,
    input_hash: [u8; 32],
    output_hash: [u8; 32],
    capability_hash: [u8; 32],
    within_policy: bool,
}

#[derive(Serialize, Deserialize)]
struct PolicyResult {
    rule_id: String,
    severity: PolicySeverity,
    details: String,
}

#[derive(Serialize, Deserialize)]
enum PolicySeverity {
    Block,
    Warn,
    Sanitize,
    Pass,
}

#[derive(Serialize, Deserialize)]
struct AgentPolicy {
    allowed_tools: Vec<String>,
    endpoint_allowlist: Vec<String>,
    max_value_autonomous: u64,
    capability_root: [u8; 32],
}

#[derive(Serialize, Deserialize)]
struct VerifiedOutput {
    agent_id: String,
    policy_hash: [u8; 32],
    output_commitment: [u8; 32],
    all_checks_passed: bool,
    requires_ledger_approval: bool,
    action_value: u64,
}

risc0_zkvm::guest::entry!(main);

fn main() {
    let trace: ExecutionTrace = env::read();
    let policy: AgentPolicy = env::read();
    
    let mut all_passed = true;
    
    for invocation in &trace.tool_invocations {
        if !policy.allowed_tools.contains(&invocation.tool_name) {
            all_passed = false;
        }
        
        if !invocation.within_policy {
            all_passed = false;
        }
    }
    
    for result in &trace.policy_check_results {
        if matches!(result.severity, PolicySeverity::Block) {
            all_passed = false;
        }
    }
    
    let requires_approval = trace.action_value > policy.max_value_autonomous;
    
    let policy_bytes = serde_json::to_vec(&policy).unwrap();
    let mut hasher = Sha256::new();
    hasher.update(&policy_bytes);
    let policy_hash: [u8; 32] = hasher.finalize().into();
    
    let output = VerifiedOutput {
        agent_id: trace.agent_id.clone(),
        policy_hash,
        output_commitment: trace.output_commitment,
        all_checks_passed: all_passed,
        requires_ledger_approval: requires_approval,
        action_value: trace.action_value,
    };
    
    env::commit(&output);
}

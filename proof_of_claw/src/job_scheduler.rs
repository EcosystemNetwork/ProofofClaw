//! Simple async job scheduler for Proof of Claw with file-based persistence.
//!
//! IronClaw manages the full agent loop; this module handles lightweight
//! internal POC jobs like proof generation tasks. Jobs are persisted to a
//! JSON file so state survives process restarts.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Status of a scheduled job.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

/// A tracked async job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub status: JobStatus,
}

/// Persistent job scheduler backed by a JSON file.
pub struct JobScheduler {
    jobs: HashMap<String, Job>,
    storage_path: Option<PathBuf>,
}

impl Default for JobScheduler {
    fn default() -> Self {
        Self {
            jobs: HashMap::new(),
            storage_path: None,
        }
    }
}

impl JobScheduler {
    /// Create an in-memory scheduler (no persistence).
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a scheduler that persists jobs to the given file path.
    /// Loads existing jobs from the file if it exists.
    pub fn with_storage(path: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let storage_path = path.as_ref().to_path_buf();
        let jobs = if storage_path.exists() {
            let data = std::fs::read_to_string(&storage_path)?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            HashMap::new()
        };

        Ok(Self {
            jobs,
            storage_path: Some(storage_path),
        })
    }

    /// Schedule a job and return its generated ID.
    pub fn schedule(&mut self, mut job: Job) -> String {
        let id = Uuid::new_v4().to_string();
        job.id = id.clone();
        self.jobs.insert(id.clone(), job);
        self.persist();
        id
    }

    /// Get the current status of a job by ID.
    pub fn get_status(&self, id: &str) -> Option<JobStatus> {
        self.jobs.get(id).map(|j| j.status.clone())
    }

    /// Mark a job as completed.
    pub fn complete(&mut self, id: &str) {
        if let Some(job) = self.jobs.get_mut(id) {
            job.status = JobStatus::Completed;
            self.persist();
        }
    }

    /// Mark a job as failed.
    pub fn fail(&mut self, id: &str) {
        if let Some(job) = self.jobs.get_mut(id) {
            job.status = JobStatus::Failed;
            self.persist();
        }
    }

    /// Mark a job as running.
    pub fn start(&mut self, id: &str) {
        if let Some(job) = self.jobs.get_mut(id) {
            job.status = JobStatus::Running;
            self.persist();
        }
    }

    /// Remove completed and failed jobs older than the retention window.
    pub fn prune_finished(&mut self) {
        self.jobs
            .retain(|_, j| j.status == JobStatus::Pending || j.status == JobStatus::Running);
        self.persist();
    }

    /// List all tracked jobs.
    pub fn list(&self) -> Vec<&Job> {
        self.jobs.values().collect()
    }

    /// Write current state to the backing file (no-op if in-memory only).
    fn persist(&self) {
        if let Some(path) = &self.storage_path {
            if let Ok(data) = serde_json::to_string_pretty(&self.jobs) {
                let _ = std::fs::write(path, data);
            }
        }
    }
}

mod job_definition;

use std::collections::BTreeMap;

pub use job_definition::JobDefinition;

use crate::{spawner::SpawnResult, target::Target};

enum JobPhase {
    Awaiting(Vec<Target>),
    Running,
    //TODO AAZ: Errors on Spawn calls should terminate the execution. Make sure results aren't
    // returned if a command fails or for expect reasons
    Done(SpawnResult),
}

struct JobState {
    phase: JobPhase,
    job_number: usize,
}

pub struct JobsRunner {
    // BTreeMap keeps the jobs in logical ordering
    jobs: BTreeMap<JobDefinition, JobState>,
    resolved_targets: Vec<Target>,
}

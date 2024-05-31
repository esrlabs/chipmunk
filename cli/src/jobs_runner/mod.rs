mod job_definition;
mod jobs_resolver;

use std::collections::{BTreeMap, BTreeSet};

pub use job_definition::JobDefinition;

use crate::{job_type::JobType, spawner::SpawnResult, target::Target};

enum JobPhase {
    Awaiting(Vec<Target>),
    Running,
    //TODO AAZ: Errors on Spawn calls should terminate the execution. Make sure results aren't
    // returned if a command fails or for expect reasons
    Done(SpawnResult),
    Skipped,
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

impl JobsRunner {
    pub fn print_deps(targets: &[Target], main_job: JobType) {
        let jobs_tree = jobs_resolver::resolve(targets, main_job);
        dbg!(jobs_tree);
        todo!()
    }
}

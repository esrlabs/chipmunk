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
    pub async fn run_jobs(
        targets: &[Target],
        main_job: JobType,
    ) -> Vec<Result<SpawnResult, anyhow::Error>> {
        let jobs_tree = jobs_resolver::resolve(targets, main_job);

        // This is needed for assertions while in development only, and it will be removed once the
        // concurrent solution is implemented.
        let mut finished = BTreeSet::new();

        let mut results = Vec::new();

        for (job_def, deps) in jobs_tree {
            assert!(
                deps.iter().all(|def| finished.contains(def)),
                "Jobs deps must be resolved before running it"
            );

            let Some(res) = job_def.run().await else {
                if cfg!(debug_assertions) {
                    panic!(
                        "Jobs tree should contain only runnable jobs. JobDefinition: {job_def:?}"
                    );
                } else {
                    continue;
                }
            };

            results.push(res);

            finished.insert(job_def);
        }

        results
    }
}

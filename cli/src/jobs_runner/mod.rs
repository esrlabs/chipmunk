//TODO AAZ: Remove this when done prototyping
#![allow(dead_code, unused_imports, unused)]

mod job_definition;
mod jobs_resolver;

use std::collections::{BTreeMap, BTreeSet};

pub use job_definition::JobDefinition;

use crate::{job_type::JobType, spawner::SpawnResult, target::Target, tracker::get_tracker};

use anyhow::Result;

type SpawnResultsCollection = Vec<Result<SpawnResult>>;

enum JobPhase {
    Awaiting(Vec<Target>),
    Running,
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

impl JobsRunner {
    pub async fn run_jobs(targets: &[Target], main_job: JobType) -> Result<SpawnResultsCollection> {
        let jobs_tree = jobs_resolver::resolve(targets, main_job);

        let tracker = get_tracker().await;
        tracker
            .start_all(jobs_tree.keys().cloned().collect())
            .await?;

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

        Ok(results)
    }
}

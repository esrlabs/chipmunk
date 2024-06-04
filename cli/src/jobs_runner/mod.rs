//TODO AAZ: Remove this when done prototyping
#![allow(dead_code, unused_imports, unused)]

mod job_definition;
mod jobs_resolver;

use std::collections::{BTreeMap, BTreeSet};

pub use job_definition::JobDefinition;

use crate::{
    checksum_records::ChecksumRecords,
    job_type::{self, JobType},
    spawner::SpawnResult,
    target::Target,
    tracker::get_tracker,
};

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

        // TODO AAZ: This is needed for assertions while in development only, and it will be removed
        // once the concurrent solution is implemented.
        let mut finished = BTreeSet::new();

        let mut skipped_map = BTreeMap::new();
        let mut failed_jobs = Vec::new();

        let mut results = Vec::new();

        for (job_def, deps) in jobs_tree {
            assert!(
                deps.iter().all(|def| finished.contains(def)),
                "Jobs deps must be resolved before running it"
            );

            let skip = if job_def.job_type.is_part_of_build() {
                // Skip if any prequel job of this target has failed
                if failed_jobs.contains(&job_def.target) {
                    true
                }
                // Check if target is already registered and checked
                else if let Some(skip) = skipped_map.get(&job_def.target) {
                    *skip
                } else {
                    let prod = job_def.job_type.is_production().is_some_and(|prod| prod);
                    let checksum_rec = ChecksumRecords::get(prod).await?;
                    checksum_rec.register_job(job_def.target)?;

                    if job_def
                        .target
                        .deps()
                        .iter()
                        .all(|dep| skipped_map.get(dep).is_some_and(|skip| *skip))
                    {
                        let calc_skip = !checksum_rec.check_changed(job_def.target)?;
                        skipped_map.insert(job_def.target, calc_skip);
                        calc_skip
                    } else {
                        false
                    }
                }
            } else {
                false
            };

            let Some(res) = job_def.run(skip).await else {
                if cfg!(debug_assertions) {
                    panic!(
                        "Jobs tree should contain only runnable jobs. JobDefinition: {job_def:?}"
                    );
                } else {
                    continue;
                }
            };

            if res.is_err() {
                failed_jobs.push(job_def.target);
            }

            results.push(res);

            finished.insert(job_def);
        }

        Ok(results)
    }
}

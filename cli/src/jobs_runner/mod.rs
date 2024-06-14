mod job_definition;
pub mod jobs_resolver;

use std::collections::BTreeMap;

pub use job_definition::JobDefinition;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

use crate::{
    checksum_records::ChecksumRecords, job_type::JobType, spawner::SpawnResult, target::Target,
    tracker::get_tracker,
};

use anyhow::Result;

type SpawnResultsCollection = Vec<Result<SpawnResult>>;

#[derive(Debug, Clone)]
/// Represents the current state of the task.
enum JobPhase {
    /// Job is waiting to the jobs in the list to finish
    Awaiting(Vec<JobDefinition>),
    /// Job is running currently
    Running,
    /// Job is finished
    Done,
}

/// Runs all the needed tasks for the given targets and the main jobs asynchronously,
/// returning a list of the tasks results
pub async fn run(targets: &[Target], main_job: JobType) -> Result<SpawnResultsCollection> {
    let jobs_tree = jobs_resolver::resolve(targets, main_job);

    let tracker = get_tracker().await;
    tracker
        .register_all(jobs_tree.keys().cloned().collect())
        .await?;

    let mut jobs_status: BTreeMap<JobDefinition, JobPhase> = jobs_tree
        .into_iter()
        .map(|(job, deps)| (job, JobPhase::Awaiting(deps)))
        .collect();

    let (tx, mut rx) = unbounded_channel::<(JobDefinition, Result<SpawnResult>)>();

    let mut skipped_map = BTreeMap::new();
    let mut failed_jobs = Vec::new();

    // Spawn free job at first
    spawn_jobs(tx.clone(), &mut jobs_status, &mut skipped_map, &failed_jobs).await?;

    let mut results = Vec::new();

    while let Some((job_def, result)) = rx.recv().await {
        // Update job state
        jobs_status
            .entry(job_def)
            .and_modify(|phase| *phase = JobPhase::Done);

        if result.is_err() {
            failed_jobs.push(job_def.target);
        }

        results.push(result);

        let mut all_done = true;

        // Remove finished job from waiting lists to the awaiting jobs.
        // And check if all jobs are done at same time.
        for (_, mut phase) in jobs_status.iter_mut() {
            let deps = match &mut phase {
                JobPhase::Awaiting(deps) => {
                    all_done = false;
                    deps
                }
                JobPhase::Running => {
                    all_done = false;
                    continue;
                }
                JobPhase::Done => continue,
            };

            if let Some(dep_idx) = deps.iter().position(|j| *j == job_def) {
                let _ = deps.swap_remove(dep_idx);
            }
        }

        if all_done {
            return Ok(results);
        }

        // Spawn more jobs after updating jobs_status tree.
        spawn_jobs(tx.clone(), &mut jobs_status, &mut skipped_map, &failed_jobs).await?;
    }

    Ok(results)
}

/// Iterate over jobs states maps and spawn the jobs that aren't waiting for any jobs to be done
async fn spawn_jobs(
    sender: UnboundedSender<(JobDefinition, Result<SpawnResult>)>,
    jobs_status: &mut BTreeMap<JobDefinition, JobPhase>,
    skipped_map: &mut BTreeMap<Target, bool>,
    failed_jobs: &[Target],
) -> Result<()> {
    for (job_def, phase) in jobs_status.iter_mut() {
        let JobPhase::Awaiting(deps) = phase else {
            continue;
        };

        if !deps.is_empty() {
            continue;
        }

        let skip = if job_def.job_type.is_part_of_build() {
            // Skip if any prequel job of this target has failed
            if failed_jobs.contains(&job_def.target) {
                true
            }
            // Check if target is already registered and checked
            else if let Some(skip) = skipped_map.get(&job_def.target) {
                *skip
            } else {
                // Calculate target checksums and compare it the persisted one
                let prod = job_def.job_type.is_production().is_some_and(|prod| prod);
                let checksum_rec = ChecksumRecords::get(prod).await?;
                checksum_rec.register_job(job_def.target)?;

                // Check if all dependent jobs are skipped, then do the checksum calculations
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

        // Spawn the job
        let sender = sender.clone();
        let job_def = *job_def;
        tokio::spawn(async move {
            let result = job_def.run(skip).await;

            let result = match result {
                Some(res) => res,
                None => panic!("Spawned jobs already resolved and must have return value."),
            };

            if sender.send((job_def, result)).is_err() {
                let tracker = get_tracker().await;
                tracker
                    .print(format!(
                        "Error: Job results can't be sent to receiver. Job: {job_def:?}"
                    ))
                    .await;
            };
        });

        *phase = JobPhase::Running;
    }
    Ok(())
}

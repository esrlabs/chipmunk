//! Provides the type definitions and methods for a job defined with job type and the given target.

use crate::{job_type::JobType, spawner::SpawnResult, target::Target, tracker::get_tracker};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
/// Represents a development job definition
///
/// * `target`: Job Target (Shared, Client...)
/// * `job_type`: Job Type (Build, Test...)
pub struct JobDefinition {
    pub target: Target,
    pub job_type: JobType,
}

impl JobDefinition {
    pub fn new(target: Target, job_type: JobType) -> Self {
        Self { target, job_type }
    }

    /// Provide formatted job title with target and job type infos
    pub fn job_title(self) -> String {
        format!("{} {}", self.target, self.job_type)
    }

    /// Run the job definition if it has a job, communicating its status with the UI bars
    pub async fn run(self, skip: bool) -> Option<Result<SpawnResult, anyhow::Error>> {
        let tracker = get_tracker();
        if let Err(err) = tracker.start(self).await {
            return Some(Err(err));
        }

        let res = self.run_intern(skip).await;

        match res.as_ref() {
            Some(Ok(res)) => {
                if res.status.success() {
                    if res.skipped {
                        tracker.skipped(self, String::default());
                    } else {
                        tracker.success(self, String::default());
                    }
                } else {
                    tracker.fail(self, "finished with errors".into());
                }
            }
            Some(Err(err)) => tracker.fail(self, format!("finished with errors. {err}")),
            None => (),
        }

        res
    }

    #[inline]
    /// Runs the job definition if it has a job
    async fn run_intern(self, skip: bool) -> Option<Result<SpawnResult, anyhow::Error>> {
        let res = match self.job_type {
            JobType::Lint => self.target.check().await,
            JobType::Build { production } => self.target.build(production, skip).await,
            // Install run always in development at first then it should get reinstalled with
            // production after build command is ran.
            // We must deliver the correct jobtype though for the communication with tracker.
            JobType::Install { production } => {
                return self
                    .target
                    .install(false, skip, Some(JobType::Install { production }))
                    .await;
            }
            JobType::AfterBuild { production } => {
                return self.target.after_build(production, skip).await
            }
            JobType::Clean => self.target.reset().await,
            JobType::Test { production } => return self.target.test(production, skip).await,
            JobType::Run { .. } => return None,
        };

        Some(res)
    }
}

#[cfg(test)]
mod tests {

    use crate::{job_type::JobType, jobs_runner::JobDefinition};

    use super::Target;

    #[tokio::test]
    async fn target_has_job() {
        for target in Target::all() {
            for job_type in JobType::all() {
                if !target.has_job(*job_type) {
                    let job_def = JobDefinition::new(*target, *job_type);
                    assert!(
                        job_def.run_intern(false).await.is_none(),
                        "'{}' has no job for '{}' but it returns Some when calling run",
                        target,
                        job_type
                    )
                }
            }
        }
    }
}

use crate::{job_type::JobType, spawner::SpawnResult, target::Target};

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct JobDefinition {
    pub target: Target,
    pub job_type: JobType,
}

impl JobDefinition {
    pub fn new(target: Target, job_type: JobType) -> Self {
        Self { target, job_type }
    }

    pub fn job_title(&self) -> String {
        format!("{} {}", self.target, self.job_type)
    }

    pub async fn run(&self) -> Option<Result<SpawnResult, anyhow::Error>> {
        let res = match self.job_type {
            JobType::Lint => self.target.check().await,
            JobType::Build { production } => self.target.build(production).await,
            JobType::Install { production } => return self.target.install(production).await,
            JobType::AfterBuild { production } => return self.target.after_build(production).await,
            JobType::Clean => self.target.reset().await,
            JobType::Test { production } => return self.target.test(production).await,
            JobType::Run { production: _ } => return None,
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
                if !target.has_job(&job_type) {
                    let job_def = JobDefinition::new(*target, job_type.clone());
                    assert!(
                        job_def.run().await.is_none(),
                        "'{}' has no job for '{}' but it returns Some when calling run",
                        target,
                        job_type
                    )
                }
            }
        }
    }
}

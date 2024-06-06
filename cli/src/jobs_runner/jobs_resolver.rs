use std::collections::{BTreeMap, BTreeSet};

use crate::{job_type::JobType, target::Target};

use super::JobDefinition;

pub fn resolve(
    targets: &[Target],
    main_job: JobType,
) -> BTreeMap<JobDefinition, Vec<JobDefinition>> {
    let involved_jobs = flatten_jobs(main_job);

    let has_build_deps = involved_jobs
        .iter()
        .any(|job| matches!(job, JobType::Build { production: _ }));

    let involved_targets = if has_build_deps {
        flatten_targets_for_build(targets)
    } else {
        BTreeSet::from_iter(targets.to_owned())
    };

    let mut jobs_tree: BTreeMap<JobDefinition, Vec<JobDefinition>> = BTreeMap::new();

    for target in involved_targets {
        for job in involved_jobs.iter().filter(|j| target.has_job(j)) {
            // Start with dependencies from other targets (Applies for Build & Install jobs only)
            // Install jobs are involved here too because copying the files in the after build
            // process could delete the current files.
            let mut dep_jobs = if matches!(
                job,
                JobType::Build { production: _ } | JobType::Install { production: _ }
            ) {
                let deps = flatten_targets_for_build(target.deps().as_slice());

                jobs_tree
                    .keys()
                    .filter(|job_def| deps.contains(&job_def.target))
                    .cloned()
                    .collect()
            } else {
                Vec::new()
            };

            // Add dependencies from the same target
            // NOTE: This relays on that JobType enums are listed in the current order
            dep_jobs.extend(
                jobs_tree
                    .keys()
                    .filter(|job_d| job_d.target == target)
                    .cloned(),
            );

            let job_def = JobDefinition::new(target, *job);

            assert!(
                jobs_tree.insert(job_def, dep_jobs).is_none(),
                "JobDefinition is added to tree more than once. Target: {}, Job: {}",
                target,
                job
            );
        }
    }

    jobs_tree
}

fn flatten_jobs(main_job: JobType) -> BTreeSet<JobType> {
    fn flatten_rec(job: JobType, involved_jobs: &mut BTreeSet<JobType>) {
        if !involved_jobs.insert(job) {
            return;
        }
        for involved_job in job.get_involved_jobs() {
            flatten_rec(involved_job, involved_jobs);
        }
    }

    let mut jobs = BTreeSet::new();

    flatten_rec(main_job, &mut jobs);

    jobs
}

fn flatten_targets_for_build(targets: &[Target]) -> BTreeSet<Target> {
    fn flatten_rec(target: Target, involved_targets: &mut BTreeSet<Target>) {
        if !involved_targets.insert(target) {
            return;
        }
        for involved_target in target.deps() {
            flatten_rec(involved_target, involved_targets);
        }
    }

    let mut resolved_targets = BTreeSet::new();

    for target in targets {
        flatten_rec(*target, &mut resolved_targets);
    }

    resolved_targets
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flatten_clean_job() {
        let expected_clean = BTreeSet::from([JobType::Clean]);
        assert_eq!(flatten_jobs(JobType::Clean), expected_clean);
    }

    #[test]
    fn flatten_lint_job() {
        let production = false;
        let expected_lint = BTreeSet::from([JobType::Lint, JobType::Install { production }]);
        assert_eq!(flatten_jobs(JobType::Lint), expected_lint);
    }

    #[test]
    fn flatten_install_job() {
        let production = false;
        let expected_install = BTreeSet::from([JobType::Install { production }]);
        assert_eq!(
            flatten_jobs(JobType::Install { production }),
            expected_install
        );
    }

    #[test]
    fn flatten_build_job() {
        let production = false;
        let expected_build = BTreeSet::from([
            JobType::Build { production },
            JobType::Install { production },
            JobType::AfterBuild { production },
        ]);
        assert_eq!(flatten_jobs(JobType::Build { production }), expected_build);
    }

    #[test]
    fn flatten_test_job() {
        let production = false;
        let expected_test = BTreeSet::from([
            JobType::Build { production },
            JobType::Install { production },
            JobType::AfterBuild { production },
            JobType::Test { production },
        ]);
        assert_eq!(flatten_jobs(JobType::Test { production }), expected_test);
    }

    #[test]
    fn flatten_core_target() {
        let expected = BTreeSet::from([Target::Core]);
        assert_eq!(flatten_targets_for_build(&[Target::Core]), expected);
    }

    #[test]
    fn flatten_wrapper_target() {
        let expected = BTreeSet::from([Target::Shared, Target::Binding, Target::Wrapper]);
        assert_eq!(flatten_targets_for_build(&[Target::Wrapper]), expected);
    }

    #[test]
    fn flatten_app_target() {
        let expected = BTreeSet::from([
            Target::Core,
            Target::Shared,
            Target::Binding,
            Target::Wrapper,
            Target::Client,
            Target::Wasm,
            Target::Updater,
            Target::App,
        ]);
        assert_eq!(flatten_targets_for_build(&[Target::App]), expected);
    }

    #[test]
    fn flatten_all_target() {
        let expected = BTreeSet::from_iter(Target::all().to_owned());
        assert_eq!(flatten_targets_for_build(&Target::all()), expected);
    }

    #[test]
    fn flatten_core_client_target() {
        let expected =
            BTreeSet::from_iter([Target::Core, Target::Shared, Target::Wasm, Target::Client]);
        assert_eq!(
            flatten_targets_for_build(&[Target::Core, Target::Client]),
            expected
        );
    }

    #[test]
    fn resolve_lint_core_cli() {
        let expected = BTreeMap::from([
            (JobDefinition::new(Target::Core, JobType::Lint), Vec::new()),
            (JobDefinition::new(Target::Cli, JobType::Lint), Vec::new()),
        ]);

        assert_eq!(
            expected,
            resolve(&[Target::Core, Target::Cli], JobType::Lint)
        );
    }

    #[test]
    fn resolve_test_core() {
        let production = false;
        let expected = BTreeMap::from([
            (
                JobDefinition::new(Target::Core, JobType::Build { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Core, JobType::Test { production }),
                vec![JobDefinition::new(
                    Target::Core,
                    JobType::Build { production: false },
                )],
            ),
        ]);

        assert_eq!(
            expected,
            resolve(&[Target::Core], JobType::Test { production })
        );
    }

    #[test]
    fn resolve_build_binding() {
        let production = false;
        let expected = BTreeMap::from([
            (
                JobDefinition::new(Target::Shared, JobType::Install { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Shared, JobType::Build { production }),
                vec![JobDefinition::new(
                    Target::Shared,
                    JobType::Install { production },
                )],
            ),
            (
                JobDefinition::new(Target::Binding, JobType::Install { production }),
                vec![
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Binding, JobType::Build { production }),
                vec![
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Binding, JobType::Install { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Binding, JobType::AfterBuild { production }),
                vec![
                    JobDefinition::new(Target::Binding, JobType::Install { production }),
                    JobDefinition::new(Target::Binding, JobType::Build { production }),
                ],
            ),
        ]);

        assert_eq!(
            expected,
            resolve(&[Target::Binding], JobType::Build { production })
        );
    }

    #[test]
    /// Resolves build for all targets and checks some cases in the dependencies-tree since the
    /// tree is too huge to be tested one by one.
    fn resolve_build_all_fuzzy() {
        let production = false;

        let tree = resolve(&Target::all(), JobType::Build { production });

        assert!(
            tree.get(&JobDefinition::new(
                Target::Cli,
                JobType::Build { production }
            ))
            .is_some_and(|dep| dep.is_empty()),
            "Build CLI should have no dependencies"
        );

        assert!(
            tree.get(&JobDefinition::new(
                Target::App,
                JobType::Build { production }
            ))
            .is_some_and(|dep| dep.contains(&JobDefinition::new(
                Target::Shared,
                JobType::Build { production }
            ))),
            "Build App should have dependency on shared build"
        );

        assert!(
            tree.get(&JobDefinition::new(
                Target::Wrapper,
                JobType::Build { production }
            ))
            .is_some_and(|dep| dep.contains(&JobDefinition::new(
                Target::Binding,
                JobType::AfterBuild { production }
            ))),
            "Build Wrapper should have dependency on Binding AfterBuild"
        );

        assert!(
            tree.get(&JobDefinition::new(
                Target::Wrapper,
                JobType::Build { production }
            ))
            .is_some_and(|dep| dep.contains(&JobDefinition::new(
                Target::Binding,
                JobType::AfterBuild { production }
            ))),
            "Build Wrapper should have dependency on Binding AfterBuild"
        );

        assert!(
            tree.get(&JobDefinition::new(
                Target::App,
                JobType::Install { production }
            ))
            .is_some_and(|dep| dep.contains(&JobDefinition::new(
                Target::Wasm,
                JobType::Build { production }
            ))),
            "Install App should have dependency on Wasm Build"
        );
    }
}

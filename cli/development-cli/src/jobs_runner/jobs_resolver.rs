//! Provides methods to resolve all the dependencies for the given job definition.

use std::collections::{BTreeMap, BTreeSet};

use crate::{job_type::JobType, target::Target};

use super::JobDefinition;

/// Resolve tasks dependencies for the given targets and job,
/// returning dependencies map for the tasks
pub fn resolve(
    targets: &[Target],
    main_job: JobType,
) -> BTreeMap<JobDefinition, Vec<JobDefinition>> {
    let involved_jobs = flatten_jobs(main_job);

    let has_build_deps = involved_jobs
        .iter()
        .any(|job| matches!(job, JobType::Build { .. }));

    let involved_targets = if has_build_deps {
        flatten_targets_for_build(targets)
    } else {
        BTreeSet::from_iter(targets.to_owned())
    };

    let mut jobs_tree: BTreeMap<JobDefinition, Vec<JobDefinition>> = BTreeMap::new();

    for target in involved_targets {
        for job in involved_jobs
            .iter()
            .filter(|&&j| is_job_involved(target, j, &main_job, targets))
        {
            // Start with dependencies from other targets (Applies for Build & Install jobs only)
            let mut dep_jobs = match job {
                // Install jobs are involved here too because copying the files in the after build
                // process could delete the current files.
                JobType::Build { .. } | JobType::Install { .. } => {
                    let deps = target.flatten_deps();

                    // Jobs of the dependencies are already included in the jobs tree because we
                    // are iterating through targets and jobs in the matching order of their
                    // dependencies relations.
                    jobs_tree
                        .keys()
                        .filter(|job_def| {
                            job_def.job_type.is_build_related() && deps.contains(&job_def.target)
                        })
                        .cloned()
                        .collect()
                }

                // Other job types doesn't have dependencies
                JobType::Clean
                | JobType::AfterBuild { .. }
                | JobType::Lint
                | JobType::Test { .. }
                | JobType::Run { .. } => Vec::new(),
            };

            // Add dependencies jobs from the same target
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

/// Returns all involved job types according to the given job type.
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

/// Returns all involved targets for the given target for build tasks
fn flatten_targets_for_build(targets: &[Target]) -> BTreeSet<Target> {
    let mut resolved_targets = BTreeSet::from_iter(targets.iter().copied());

    for target in targets {
        resolved_targets.extend(target.flatten_deps());
    }

    resolved_targets
}

/// Check if job involved depending if the target has a job for the current job type + Additional
/// filter based on the main job type.
/// The additional filter is currently used because linting and running tests on TS and WASM targets
/// require all build steps to be done on them and their dependencies.
///
/// * `target`: Job Target
/// * `current_job`: Current job type to check if it has job for the given target
/// * `main_job`: Main job type, which is used for the additional filter
/// * `original_targets`: original targets associated with the main job
fn is_job_involved(
    target: Target,
    current_job: JobType,
    main_job: &JobType,
    original_targets: &[Target],
) -> bool {
    // This filter handle the special cases of adding build steps for TS and WASM lints and tests
    // and remove those jobs from the not involved targets
    let additional_filter = || {
        match main_job {
            // Linting for TS and WASM targets inquire that those targets are built
            JobType::Lint => match target {
                // * Linting for Rust core doesn't need any build and must be excluded in the
                //   additional filter.
                Target::Core => match current_job {
                    // When the current job matches the main job we need to check if the target is
                    // included in the original targets
                    JobType::Lint => original_targets.contains(&target),
                    // Otherwise we need to check if the targets have core in their dependencies to
                    // build the core since it's needed for their linting jobs.
                    _ => original_targets
                        .iter()
                        .any(|t| t.flatten_deps().contains(&Target::Core)),
                },
                // These targets aren't involved in the dependencies tree.
                Target::CliDev | Target::Updater | Target::CliChipmunk => {
                    matches!(current_job, JobType::Lint)
                }
                // TS and Bindings targets need to be built with all their dependencies to perform the
                // needed type checks on TypeScript
                Target::Shared
                | Target::Binding
                | Target::Wrapper
                | Target::Wasm
                | Target::Protocol
                | Target::Client
                | Target::App => {
                    // Only building jobs for dependencies is required.
                    // For example: Linting jobs for dependencies shouldn't be involved when they
                    // are not included in the original targets.
                    current_job.is_build_related() || original_targets.contains(&target)
                }
            },

            // Tests for TS and WASM targets inquire that those targets are built
            JobType::Test { .. } => match target {
                // * Running tests for rust core doesn't inquire running build on it.
                // * It should excluded in the filter if it's not included in the original targets
                //   dependencies before being flatted. This is to avoid running test on core if we
                //   want to run test on Binding or Wrapper.
                Target::Core => match current_job {
                    // When the current job matches the main job we need to check if the target is
                    // included in the original targets
                    JobType::Test { .. } => original_targets.contains(&target),
                    // Otherwise we need to check if the targets have core in their dependencies to
                    // build the core since it's needed for their testing jobs.
                    _ => original_targets
                        .iter()
                        .any(|t| t.flatten_deps().contains(&Target::Core)),
                },
                // These targets aren't involved in the dependencies tree.
                Target::CliDev | Target::Updater | Target::CliChipmunk => {
                    matches!(current_job, JobType::Test { .. })
                }

                // TS and Bindings targets need to be built with all their dependencies to perform the
                // needed tests on TypeScript targets.
                Target::Shared
                | Target::Binding
                | Target::Wrapper
                | Target::Wasm
                | Target::Protocol
                | Target::Client
                | Target::App => {
                    // Only building jobs for dependencies is required.
                    // For example: Test jobs for dependencies shouldn't be involved when they
                    // are not included in the original targets.
                    current_job.is_build_related() || original_targets.contains(&target)
                }
            },
            JobType::Clean
            | JobType::Install { .. }
            | JobType::Build { .. }
            | JobType::AfterBuild { .. }
            | JobType::Run { .. } => true,
        }
    };

    target.has_job(current_job) && additional_filter()
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn flatten_clean_job() {
        let expected_clean = BTreeSet::from([JobType::Clean]);
        assert_eq!(flatten_jobs(JobType::Clean), expected_clean);
    }

    #[test]
    fn flatten_lint_job() {
        let production = false;
        let expected_lint = BTreeSet::from([
            JobType::Lint,
            JobType::Install { production },
            JobType::Build { production },
            JobType::AfterBuild { production },
        ]);
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
        let expected = BTreeSet::from([
            Target::Shared,
            Target::Core,
            Target::Binding,
            Target::Protocol,
            Target::Wrapper,
        ]);
        assert_eq!(flatten_targets_for_build(&[Target::Wrapper]), expected);
    }

    #[test]
    fn flatten_app_target() {
        let expected = BTreeSet::from([
            Target::Core,
            Target::Shared,
            Target::Protocol,
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
        assert_eq!(flatten_targets_for_build(Target::all()), expected);
    }

    #[test]
    fn flatten_core_client_target() {
        let expected = BTreeSet::from_iter([
            Target::Core,
            Target::Protocol,
            Target::Shared,
            Target::Wasm,
            Target::Client,
        ]);
        assert_eq!(
            flatten_targets_for_build(&[Target::Core, Target::Client]),
            expected
        );
    }

    #[test]
    fn resolve_lint_core_cli() {
        let expected = BTreeMap::from([
            (JobDefinition::new(Target::Core, JobType::Lint), Vec::new()),
            (
                JobDefinition::new(Target::CliDev, JobType::Lint),
                Vec::new(),
            ),
        ]);

        assert_eq!(
            expected,
            resolve(&[Target::Core, Target::CliDev], JobType::Lint)
        );
    }

    #[test]
    fn resolve_test_core() {
        let production = false;
        let expected = BTreeMap::from([(
            JobDefinition::new(Target::Core, JobType::Test { production }),
            vec![],
        )]);

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
                JobDefinition::new(Target::Core, JobType::Build { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Protocol, JobType::Build { production }),
                vec![JobDefinition::new(
                    Target::Core,
                    JobType::Build { production },
                )],
            ),
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
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Binding, JobType::Build { production }),
                vec![
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
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
    /// Ensure linting ts targets will invoke all building targets involved in the dependencies tree.
    /// And on build should wait for a lint job to start.
    fn resolve_lint_wrapper() {
        let production = false;
        let expected = BTreeMap::from([
            (
                JobDefinition::new(Target::Shared, JobType::Install { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Core, JobType::Build { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Protocol, JobType::Build { production }),
                vec![JobDefinition::new(
                    Target::Core,
                    JobType::Build { production },
                )],
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
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Binding, JobType::Build { production }),
                vec![
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
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
            (
                JobDefinition::new(Target::Wrapper, JobType::Build { production }),
                vec![
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
                    JobDefinition::new(Target::Binding, JobType::Install { production }),
                    JobDefinition::new(Target::Binding, JobType::Build { production }),
                    JobDefinition::new(Target::Binding, JobType::AfterBuild { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Wrapper, JobType::Lint),
                vec![JobDefinition::new(
                    Target::Wrapper,
                    JobType::Build { production },
                )],
            ),
        ]);

        assert_eq!(expected, resolve(&[Target::Wrapper], JobType::Lint));
    }

    #[test]
    /// Ensure testing ts targets will invoke all building targets involved in the dependencies tree.
    fn resolve_test_wrapper() {
        let production = false;
        let expected = BTreeMap::from([
            (
                JobDefinition::new(Target::Shared, JobType::Install { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Core, JobType::Build { production }),
                vec![],
            ),
            (
                JobDefinition::new(Target::Protocol, JobType::Build { production }),
                vec![JobDefinition::new(
                    Target::Core,
                    JobType::Build { production },
                )],
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
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Binding, JobType::Build { production }),
                vec![
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
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
            (
                JobDefinition::new(Target::Wrapper, JobType::Build { production }),
                vec![
                    JobDefinition::new(Target::Core, JobType::Build { production }),
                    JobDefinition::new(Target::Shared, JobType::Install { production }),
                    JobDefinition::new(Target::Shared, JobType::Build { production }),
                    JobDefinition::new(Target::Protocol, JobType::Build { production }),
                    JobDefinition::new(Target::Binding, JobType::Install { production }),
                    JobDefinition::new(Target::Binding, JobType::Build { production }),
                    JobDefinition::new(Target::Binding, JobType::AfterBuild { production }),
                ],
            ),
            (
                JobDefinition::new(Target::Wrapper, JobType::Test { production }),
                vec![JobDefinition::new(
                    Target::Wrapper,
                    JobType::Build { production },
                )],
            ),
        ]);

        assert_eq!(
            expected,
            resolve(&[Target::Wrapper], JobType::Test { production })
        );
    }

    #[test]
    /// Resolves build for all targets and checks some cases in the dependencies-tree since the
    /// tree is too huge to be tested one by one.
    fn resolve_build_all_fuzzy() {
        let production = false;

        let tree = resolve(Target::all(), JobType::Build { production });

        assert!(
            tree.get(&JobDefinition::new(
                Target::CliDev,
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

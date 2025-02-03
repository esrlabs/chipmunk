//! Provides the methods to print the dependencies between the targets in the `pritn-dot`
//! format to be used with `Graphviz`.

use crate::{
    job_type::JobType,
    jobs_runner::{jobs_resolver, JobDefinition},
    target::Target,
};

/// Prints an overview of targets dependencies in print-dot format for `Graphviz`
pub fn print_dependencies_targets() {
    println!("digraph dependencies {{");

    for target in Target::all() {
        for dep in target.direct_deps() {
            println!(r#"  "{target}"  -> "{dep}""#);
        }
    }

    println!("}}");
}

/// Prints an overview of jobs dependencies in print-dot format for `Graphviz`
pub fn print_dependencies_jobs() {
    let deps_tree = jobs_resolver::resolve(Target::all(), JobType::Build { production: false });
    println!("digraph dependencies {{");

    for (job, deps) in deps_tree {
        let job_txt = job_to_dot_string(&job);
        for dep in deps {
            println!(r#"  "{job_txt}"  -> "{}""#, job_to_dot_string(&dep));
        }
    }

    println!("}}");
}

fn job_to_dot_string(job_def: &JobDefinition) -> String {
    let job_type = match job_def.job_type {
        JobType::Install { .. } => "Install",
        JobType::Build { .. } => "Build",
        JobType::AfterBuild { .. } => "After Build (Copy & Reinstall)",
        JobType::Clean | JobType::Lint | JobType::Test { .. } | JobType::Run { .. } => {
            unreachable!("Only build-related jobs are included in dot print")
        }
    };

    format!("{}: {job_type}", job_def.target)
}

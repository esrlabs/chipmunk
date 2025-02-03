//! Provides methods to print the logs of the results of spawned jobs to the console.

use console::style;

use crate::spawner::SpawnResult;

/// Prints the log report for the given job result
pub fn print_report(spawn_result: &SpawnResult) {
    match (spawn_result.skipped, spawn_result.status.success()) {
        // Skipped
        (true, _) => {
            let msg = format!("Job '{}' has been skipped", spawn_result.job);
            println!("{}", style(msg).cyan().bold());
        }
        // Succeeded
        (_, true) => {
            let msg = format!("Job '{}' has succeeded", spawn_result.job);
            println!("{}", style(msg).green().bold());
        }
        // Failed
        (_, false) => {
            let msg = format!("Job '{}' has failed", spawn_result.job);
            println!("{}", style(msg).red().bold());
        }
    };
    println!();

    println!("Command: {}", spawn_result.cmd);
    if spawn_result.skipped {
        return;
    }

    println!("Logs:");

    spawn_result
        .report
        .iter()
        .for_each(|line| println!("{}", line.trim_end()))
}

/// Prints a separator to be used between the jobs reports.
pub fn print_log_separator() {
    println!();
    println!("====================================================");
    println!();
}

use crate::spawner::SpawnResult;

/// Prints the log report for the given job result
pub fn print_report(spawn_result: &SpawnResult) {
    let status = match (spawn_result.skipped, spawn_result.status.success()) {
        (Some(true), _) => "been skipped",
        (_, true) => "succeeded",
        (_, false) => "failed",
    };

    println!("Job '{}' has {status}", spawn_result.job);
    println!("Command: {}", spawn_result.cmd);
    if spawn_result.skipped.is_some_and(|skipped| skipped) {
        return;
    }

    println!("Logs:");

    spawn_result
        .report
        .iter()
        .for_each(|line| println!("{}", line.trim()))
}

/// Prints a separator to be used between the jobs reports.
pub fn print_log_separator() {
    println!();
    println!("====================================================");
    println!();
}

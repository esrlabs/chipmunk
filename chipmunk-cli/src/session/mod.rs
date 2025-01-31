pub mod file;
pub mod format;
pub mod socket;

/// Writes summary of the process session.
fn write_summary(
    msg_count: usize,
    skipped_count: usize,
    empty_count: usize,
    incomplete_count: usize,
) {
    const UNDERLINE_ANSI: &str = "\x1b[4m";
    const RESET_ANSI: &str = "\x1b[0m";

    println!("{UNDERLINE_ANSI}Process Summary{RESET_ANSI}:");

    println!("* {msg_count} messages has been written to file.");
    if skipped_count > 0 {
        println!("* {skipped_count} messages skipped");
    }
    if empty_count > 0 {
        println!("* {empty_count} messages were empty");
    }
    if incomplete_count > 0 {
        println!("* {incomplete_count} messages were incomplete");
    }
}

//! Manages the environment variables for the release job, including loading them from `.env` files.

use console::style;

/// Loads the environment variables form `.env` file if available,
/// printing the loading state to the console.
pub fn load_from_env_file() {
    match dotenvy::dotenv() {
        Ok(path) => {
            println!(
                "{}\n`.env` file path: {}",
                style("`.env` file loaded").green(),
                path.display()
            )
        }
        Err(err) => {
            println!(
                "{} Info: {err}",
                style("dotenv for local environment not found, not considering .env file.").cyan()
            );
        }
    }
}

/// Checks if the tool is running on arm architecture.
pub const fn is_arm_archit() -> bool {
    cfg!(any(target_arch = "arm", target_arch = "aarch64"))
}

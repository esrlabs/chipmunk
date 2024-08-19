use console::style;

pub const APPLEID_ENV: &str = "APPLEID";
pub const APPLEIDPASS_ENV: &str = "APPLEIDPASS";
pub const SKIP_NOTARIZE_ENV: &str = "SKIP_NOTARIZE";

pub fn load_from_env_file() {
    debug_assert!(
        !crate::tracker::get_tracker().show_bars(),
        "Release shouldn't run with UI bars"
    );

    match dotenvy::dotenv() {
        Ok(path) => {
            println!(
                "{}\n`.env` file path: {}",
                style("`.env` file loaded").green(),
                path.display()
            )
        }
        Err(err) => {
            eprintln!(
                "{} Error: {err}",
                style("dotenv not found, not considering .env file!.").yellow()
            );
        }
    }
}

pub fn is_arm_archit() -> bool {
    cfg!(any(target_arch = "arm", target_arch = "aarch64"))
}

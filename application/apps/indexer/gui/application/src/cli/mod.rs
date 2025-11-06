use std::path::PathBuf;

mod command;

pub use command::CliCommand;

const HELP_TEMPLATE: &str = "\
{before-help}{about}
version: {version}

{usage-heading} {usage}

{all-args}{after-help}
";

#[derive(Debug, clap::Parser)]
#[clap(name = "chipmunk", version, about, help_template = HELP_TEMPLATE)]
pub struct Cli {
    /// Specify file path to be opened.
    #[arg(index = 1, name = "PATH")]
    pub file_path: Option<PathBuf>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ensure the CLI configurations are valid.
    #[test]
    fn verify_cli() {
        use clap::CommandFactory;
        Cli::command().debug_assert();
    }
}

use std::io;

use clap::CommandFactory;
use clap_complete::{generate, Shell};

use crate::cli_args::CargoCli;

/// Generates shell complition for the given shell printing them to stdout
pub fn generate_completion(shell: Shell) {
    let mut cmd = CargoCli::command();
    let bin_name = cmd.get_bin_name().unwrap().to_owned();

    generate(shell, &mut cmd, bin_name, &mut io::stdout());
}

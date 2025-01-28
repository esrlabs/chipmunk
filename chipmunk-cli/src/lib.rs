use clap::Parser;

mod cli_args;

pub async fn run_app() -> anyhow::Result<()> {
    let cli = cli_args::Cli::parse();
    Ok(())
}

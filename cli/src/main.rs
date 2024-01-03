mod fstools;
mod location;
mod modules;
mod spawner;
mod target;
mod tools;
mod tracker;

use clap::{Parser, Subcommand};
use futures::future::join_all;
use location::Location;
use modules::Manager;
use std::io::{Error, ErrorKind};
use target::Target;
use tools::RemoveDuplicates;
use tracker::Tracker;

#[macro_use]
extern crate lazy_static;

lazy_static! {
    static ref LOCATION: Location =
        Location::new().expect("Fail to setup location of root of project");
    static ref TRACKER: Tracker = Tracker::new();
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Build release version
    #[arg(short, long, action = clap::ArgAction::Count)]
    release: u8,

    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand, Debug, Clone)]
enum Command {
    /// runs linting & clippy
    Lint {
        /// target to build, by default whole application will be built
        #[arg(short, long, num_args(0..))]
        target: Option<Vec<Target>>,
    },
    /// build
    Build {
        /// target to build, by default whole application will be built
        #[arg(short, long, num_args(0..))]
        target: Option<Vec<Target>>,
    },
    /// Clean
    Clean {
        /// target to build, by default whole application will be built
        #[arg(short, long, num_args(0..))]
        target: Option<Vec<Target>>,
    },
    /// Run tests
    Test {
        /// target to test, by default whole application will be tested
        #[arg(short, long, num_args(0..))]
        target: Option<Vec<Target>>,
    },
}

fn main() -> Result<(), Error> {
    async_io::block_on(async {
        let cli = Cli::parse();
        let production = cli.release > 0;
        if let Some(ref command) = cli.command {
            let targets: Vec<Box<dyn Manager + Sync + Send>> = if let Some(mut list) =
                match command.clone() {
                    Command::Lint { target } => target,
                    Command::Build { target } => target,
                    Command::Clean { target } => target,
                    Command::Test { target } => target,
                } {
                list.remove_duplicates();
                list.iter().map(|target| target.get()).collect()
            } else {
                Target::all()
            };
            let results = match command {
                Command::Lint { target: _ } => {
                    join_all(
                        targets
                            .iter()
                            .map(|module| module.check())
                            .collect::<Vec<_>>(),
                    )
                    .await
                }
                Command::Build { target: _ } => {
                    join_all(
                        targets
                            .iter()
                            .map(|module| module.build(production))
                            .collect::<Vec<_>>(),
                    )
                    .await
                }
                Command::Clean { target: _ } => {
                    join_all(
                        targets
                            .iter()
                            .map(|module| module.reset())
                            .collect::<Vec<_>>(),
                    )
                    .await
                }
                Command::Test { target: _ } => {
                    join_all(
                        targets
                            .iter()
                            .map(|module| module.test())
                            .collect::<Vec<_>>(),
                    )
                    .await
                }
            };
            TRACKER.shutdown().await?;
            let mut success: bool = true;
            results.iter().for_each(|res| match res {
                Ok(status) => {
                    if !status.status.success() {
                        eprintln!("Failed with errors");
                        println!("{}:\n{}", status.job, status.stderr.join(""));
                        success = false;
                    }
                }
                Err(err) => {
                    eprintln!("Builder error: {err}");
                    success = false;
                }
            });
            if !success {
                return Err(Error::new(ErrorKind::Other, "Some task were failed"));
            }
        }
        Ok(())
    })
}

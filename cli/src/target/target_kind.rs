//! Provides the types and methods to define the target kind (Rust or Type Script).

use crate::dev_tools::DevTool;

use super::{yarn_command, ProcessCommand};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetKind {
    /// TypeScript
    Ts,
    /// Rust
    Rs,
}

impl TargetKind {
    /// Provide the general build command for each target type
    pub fn build_cmd(&self, prod: bool) -> ProcessCommand {
        match self {
            TargetKind::Ts => {
                let mut args = vec![String::from("run")];
                if prod {
                    args.push("prod".into());
                } else {
                    args.push("build".into());
                }

                yarn_command(args)
            }
            TargetKind::Rs => {
                let mut args = vec![
                    String::from("build"),
                    String::from("--color"),
                    String::from("always"),
                ];
                if prod {
                    args.push("--release".into());
                }

                ProcessCommand::new(DevTool::Cargo.cmd(), args)
            }
        }
    }
    /// Provide the general install command for each target type
    pub fn install_cmd(&self, prod: bool) -> Option<ProcessCommand> {
        match self {
            TargetKind::Ts => {
                let args = if prod {
                    vec![
                        String::from("workspaces"),
                        String::from("focus"),
                        String::from("--production"),
                    ]
                } else {
                    vec![String::from("install")]
                };

                let command = yarn_command(args);

                Some(command)
            }
            TargetKind::Rs => None,
        }
    }
}

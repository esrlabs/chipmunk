use std::{ops::Not, path::PathBuf};

use stypes::ShellProfile;

#[derive(Debug, Clone)]
pub struct ProcessConfig {
    pub cwd: PathBuf,
    pub command: String,
    pub shell: Option<ShellProfile>,
    pub available_shells: Vec<ShellProfile>,
    command_error_msg: Option<&'static str>,
    cwd_error_msg: Option<&'static str>,
}

impl ProcessConfig {
    pub fn new() -> Self {
        let available_shells = shell_tools::get_available_shells().to_vec();
        let cwd = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let mut config = Self {
            cwd,
            command: String::new(),
            shell: None,
            available_shells,
            command_error_msg: None,
            cwd_error_msg: None,
        };

        config.validate();
        config
    }

    pub fn is_valid(&self) -> bool {
        let Self {
            cwd: _,
            command: _,
            shell: _,
            available_shells: _,
            command_error_msg,
            cwd_error_msg,
        } = self;
        command_error_msg.is_none() && cwd_error_msg.is_none()
    }

    pub fn validate(&mut self) {
        let Self {
            cwd,
            command,
            shell: _,
            available_shells: _,
            command_error_msg,
            cwd_error_msg,
        } = self;
        *command_error_msg = command
            .is_empty()
            .then_some("Terminal command can't be empty");
        *cwd_error_msg = cwd
            .exists()
            .not()
            .then_some("Working directory doesn't exist")
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        let Self {
            cwd: _,
            command: _,
            shell: _,
            available_shells: _,
            command_error_msg,
            cwd_error_msg,
        } = self;

        [command_error_msg, cwd_error_msg]
            .into_iter()
            .filter_map(|err| *err)
            .collect()
    }
}

impl From<ProcessConfig> for stypes::ProcessTransportConfig {
    fn from(config: ProcessConfig) -> Self {
        Self {
            cwd: config.cwd,
            command: config.command,
            shell: config.shell,
        }
    }
}

use std::path::PathBuf;

use stypes::ShellProfile;

#[derive(Debug, Clone)]
pub struct ProcessConfig {
    pub cwd: PathBuf,
    pub command: String,
    pub shell: Option<ShellProfile>,
    pub available_shells: Vec<ShellProfile>,
    err_msg: Option<&'static str>,
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
            err_msg: None,
        };

        config.validate();
        config
    }

    pub fn is_valid(&self) -> bool {
        self.err_msg.is_none()
    }

    pub fn validate(&mut self) {
        self.err_msg = self
            .command
            .is_empty()
            .then_some("Terminal command can't be empty");
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        if let Some(msg) = self.err_msg {
            vec![msg]
        } else {
            Vec::new()
        }
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

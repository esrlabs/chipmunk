use std::path::PathBuf;

use stypes::ShellProfile;

#[derive(Debug, Clone)]
pub struct ProcessConfig {
    pub cwd: PathBuf,
    pub command: String,
    pub shell: Option<ShellProfile>,
    pub available_shells: Vec<ShellProfile>,
    is_valid: bool,
}

impl ProcessConfig {
    pub fn new() -> Self {
        let available_shells = shell_tools::get_available_shells().to_vec();
        let cwd = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        Self {
            cwd,
            command: String::new(),
            shell: None,
            available_shells,
            is_valid: false,
        }
    }

    pub fn is_valid(&self) -> bool {
        self.is_valid
    }

    pub fn validate(&mut self) {
        self.is_valid = !self.command.is_empty();
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

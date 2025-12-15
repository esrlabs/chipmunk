use super::FibexFileInfo;

#[derive(Debug, Clone, Default)]
pub struct SomeIpParserConfig {
    pub fibex_files: Vec<FibexFileInfo>,
}

impl SomeIpParserConfig {
    pub fn new() -> Self {
        Self::default()
    }
}

use itertools::Itertools;
use std::path::PathBuf;
use stypes::SomeIpParserSettings;

use super::FibexFileInfo;

#[derive(Debug, Clone, Default)]
pub struct SomeIpParserConfig {
    pub fibex_files: Vec<FibexFileInfo>,
}

impl SomeIpParserConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_parser_settings(settings: &SomeIpParserSettings) -> Self {
        let fibex_files = settings
            .fibex_file_paths
            .as_ref()
            .map(|paths| {
                paths
                    .iter()
                    .map(PathBuf::from)
                    .map(FibexFileInfo::from_path_lossy)
                    .collect_vec()
            })
            .unwrap_or_default();

        Self { fibex_files }
    }
}

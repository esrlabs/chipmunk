use std::net::IpAddr;

use crate::*;
use thiserror::Error;

impl ObserveOptions {
    pub fn file(filename: PathBuf, file_origin: FileFormat, parser: ParserType) -> Self {
        ObserveOptions {
            origin: ObserveOrigin::File(Uuid::new_v4().to_string(), file_origin, filename),
            parser,
        }
    }
}

impl Default for DltParserSettings {
    fn default() -> Self {
        Self {
            filter_config: None,
            fibex_file_paths: None,
            with_storage_header: true,
            tz: None,
            fibex_metadata: None,
        }
    }
}

impl DltParserSettings {
    pub fn new_including_storage_headers(
        filter_config: Option<dlt_core::filtering::DltFilterConfig>,
        fibex_file_paths: Option<Vec<String>>,
    ) -> Self {
        Self {
            filter_config,
            fibex_file_paths,
            with_storage_header: true,
            tz: None,
            fibex_metadata: None,
        }
    }

    pub fn load_fibex_metadata(&mut self) {
        if self.fibex_metadata.is_some() {
            return;
        }
        self.fibex_metadata = if let Some(paths) = self.fibex_file_paths.as_ref() {
            dlt_core::fibex::gather_fibex_data(dlt_core::fibex::FibexConfig {
                fibex_file_paths: paths.clone(),
            })
        } else {
            None
        };
    }
}

#[derive(Error, Debug)]
pub enum NetError {
    #[error("Problem with configuration found: {0}")]
    Configuration(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

impl MulticastInfo {
    pub fn multicast_addr(&self) -> Result<IpAddr, NetError> {
        self.multiaddr.to_string().parse().map_err(|e| {
            NetError::Configuration(format!(
                "Could not parse multicast address \"{}\": {e}",
                self.multiaddr
            ))
        })
    }
}

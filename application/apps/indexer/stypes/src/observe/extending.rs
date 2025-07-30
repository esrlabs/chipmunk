use std::net::IpAddr;

use crate::*;
use thiserror::Error;

impl ComponentsList {
    pub fn new(sources: Vec<Ident>, parsers: Vec<Ident>) -> Self {
        Self { parsers, sources }
    }
}
impl SessionSetup {
    pub fn inherit(&self, origin: SessionAction) -> Self {
        Self {
            origin,
            parser: self.parser.clone(),
            source: self.source.clone(),
        }
    }
}
impl SessionDescriptor {
    pub fn new(source: Ident, parser: Ident) -> Self {
        Self {
            parser,
            source,
            p_desc: None,
            s_desc: None,
        }
    }
    pub fn set_parser_desc(&mut self, desc: Option<String>) {
        self.p_desc = desc;
    }
    pub fn set_source_desc(&mut self, desc: Option<String>) {
        self.s_desc = desc;
    }
}
impl ObserveOptions {
    /// Creates a new `ObserveOptions` instance for a file.
    ///
    /// # Parameters
    /// - `filename`: The path to the file to be observed.
    /// - `file_origin`: The format of the file (e.g., `FileFormat`).
    /// - `parser`: The parser to be used for processing the file (e.g., `ParserType`).
    ///
    /// # Returns
    /// - A new `ObserveOptions` instance configured for the specified file.
    pub fn file(filename: PathBuf, file_origin: FileFormat, parser: ParserType) -> Self {
        ObserveOptions {
            origin: ObserveOrigin::File(Uuid::new_v4().to_string(), file_origin, filename),
            parser,
        }
    }
}

impl Default for DltParserSettings {
    /// Provides a default implementation for `DltParserSettings`.
    ///
    /// # Defaults
    /// - `filter_config`: `None`
    /// - `fibex_file_paths`: `None`
    /// - `with_storage_header`: `true`
    /// - `tz`: `None`
    /// - `fibex_metadata`: `None`
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
    /// Creates a new `DltParserSettings` instance with storage headers included.
    ///
    /// # Parameters
    /// - `filter_config`: Optional filter configuration for parsing.
    /// - `fibex_file_paths`: Optional list of paths to Fibex files.
    ///
    /// # Returns
    /// - A new `DltParserSettings` instance.
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

    /// Loads Fibex metadata for the parser settings.
    ///
    /// # Details
    /// If `fibex_file_paths` is specified and `fibex_metadata` is not already loaded,
    /// this function gathers Fibex data using the specified paths.
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
/// Represents errors related to networking operations.
pub enum NetError {
    /// Indicates a problem with the configuration.
    #[error("Problem with configuration found: {0}")]
    Configuration(String),

    /// Represents an I/O error.
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

impl MulticastInfo {
    /// Parses the multicast address into an `IpAddr`.
    ///
    /// # Returns
    /// - `Ok(IpAddr)` if the address is successfully parsed.
    /// - `Err(NetError::Configuration)` if the address cannot be parsed.
    pub fn multicast_addr(&self) -> Result<IpAddr, NetError> {
        self.multiaddr.to_string().parse().map_err(|e| {
            NetError::Configuration(format!(
                "Could not parse multicast address \"{}\": {e}",
                self.multiaddr
            ))
        })
    }
}

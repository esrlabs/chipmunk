use std::path::{Path, PathBuf};

/// The name of Chipmunk directory inside home directory.
const CHIPMUNK_HOME: &str = ".chipmunk";

/// The name of the plugins directory in Chipmunk home directory.
const PLUGINS_DIR: &str = "plugins";

/// The name of the parser plugins directory in plugins directory.
const PARSER_DIR: &str = "parsers";

/// The name of the byte-source plugins directory in plugins directory.
const BYTESOURCE_DIR: &str = "bytesources";

/// The name of the producer plugins directory in plugins directory.
const PRODUCER_DIR: &str = "producers";

/// The name of the plugins README file.
const PLUGIN_README_FILENAME: &str = "README.md";

/// Provide the path for Chipmunk home directory.
pub fn get_home_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(CHIPMUNK_HOME))
}

/// Return plugins directory in Chipmunk home directory.
pub fn plugins_dir() -> Option<PathBuf> {
    get_home_dir().map(|home| home.join(PLUGINS_DIR))
}

/// Returns parser plugins directory within Chipmunk home directory.
pub fn parser_dir() -> Option<PathBuf> {
    plugins_dir().map(|plugins| plugins.join(PARSER_DIR))
}

/// Returns byte-source plugins directory within Chipmunk home directory.
pub fn bytesource_dir() -> Option<PathBuf> {
    plugins_dir().map(|plugins| plugins.join(BYTESOURCE_DIR))
}

/// Returns producer plugins directory within Chipmunk home directory.
pub fn producer_dir() -> Option<PathBuf> {
    plugins_dir().map(|plugins| plugins.join(PRODUCER_DIR))
}

/// Represents the paths for plugin files.
#[derive(Debug, Clone)]
pub struct PluginFiles {
    /// The path of the plugin `WASM` file.
    pub wasm_file: PathBuf,
    /// Metadata of the plugins found in plugins metadata `TOML` file.
    pub metadata_file: PathBuf,
    /// Path for plugin README markdown file.
    pub readme_file: PathBuf,
}

impl PluginFiles {
    /// Creates new instance with the given arguments.
    ///
    /// * `wasm_file`: The path of the plugin `WASM` file.
    /// * `metadata_file`: Metadata of the plugins found in plugins metadata `TOML` file.
    /// * `readme_file`: Path for plugin README markdown file.
    pub fn new(wasm_file: PathBuf, metadata_file: PathBuf, readme_file: PathBuf) -> Self {
        Self {
            wasm_file,
            metadata_file,
            readme_file,
        }
    }
}

/// Extract the paths for plugins binary, metadata and readme files from plugins
/// directory path by conventions.
/// The current conventions state the plugin filename and metadata must match
/// the directory name of the plugin itself and will be considered as plugin name,
/// while readme markdown files must have the name `README.md`
///
/// * `plugins_dir`: The path of the plugin directory
///
/// # Returns:
///
/// Paths for the plugin files when plugins directory is valid.
pub fn extract_plugin_file_paths(plugin_dir: &Path) -> Option<PluginFiles> {
    let plugin_name = get_plugin_name(plugin_dir)?;
    let plugin_path = plugin_dir.join(format!("{plugin_name}.wasm"));
    let metadata_path = plugin_dir.join(format!("{plugin_name}.toml"));
    let readme_path = plugin_dir.join(PLUGIN_README_FILENAME);

    Some(PluginFiles::new(plugin_path, metadata_path, readme_path))
}

/// Provide plugin name from its directory name according to conventions which
/// stats that plugin name should be matching to the directory name.
///
/// # Returns:
/// Plugin name when directory have a name, otherwise `None`
pub fn get_plugin_name(plugin_dir: &Path) -> Option<&str> {
    plugin_dir.file_name().and_then(|name| name.to_str())
}

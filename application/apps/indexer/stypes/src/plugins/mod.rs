#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

#[cfg(feature = "rustcore")]
pub use extending::*;

use crate::*;

/// Settings for the Plugins parser.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginParserSettings {
    pub plugin_path: PathBuf,
    // General setting doesn't exist in front-end since it doesn't have real fields yet.
    #[serde(default)]
    pub general_settings: PluginParserGeneralSettings,
    pub plugin_configs: Vec<PluginConfigItem>,
}

//TODO: This struct is a place holder currently and doesn't provide any value yet.
/// General settings for all parsers as plugins
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginParserGeneralSettings {
    pub placeholder: String,
}

/// Settings for the Plugin Byte-Sources.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginByteSourceSettings {
    pub plugin_path: PathBuf,
    pub general_settings: PluginByteSourceGeneralSettings,
    pub plugin_configs: Vec<PluginConfigItem>,
}

//TODO: This struct is a place holder currently and doesn't provide any value yet.
/// General settings for all byte-sources as plugins
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginByteSourceGeneralSettings {
    pub placeholder: String,
}

/// Settings for the Plugins parser.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginProducerSettings {
    pub plugin_path: PathBuf,
    // General setting doesn't exist in front-end since it doesn't have real fields yet.
    #[serde(default)]
    pub general_settings: PluginProducerGeneralSettings,
    pub plugin_configs: Vec<PluginConfigItem>,
}

/// Provides additional information to be rendered in the log view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct ProducerRenderOptions {
    /// Rendering information for the column if log messages have multiple columns.
    ///
    /// # Note:
    /// The count of the provided columns must match the count of the columns of each log message as well.
    pub columns_options: Option<ColumnsRenderOptions>,
}

//TODO: This struct is a place holder currently and doesn't provide any value yet.
/// General settings for all parsers as plugins
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginProducerGeneralSettings {
    pub placeholder: String,
}

/// Represents a configuration item, which includes an identifier and its corresponding value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginConfigItem {
    pub id: String,
    pub value: PluginConfigValue,
}

/// Represents the value of a configuration item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginConfigValue {
    Boolean(bool),
    Integer(i32),
    Float(f32),
    Text(String),
    /// List of strings representing directory paths.
    Directories(Vec<PathBuf>),
    /// List of strings representing file paths.
    Files(Vec<PathBuf>),
    /// A string representing a selected option from a drop-down menu
    Dropdown(String),
}

/// Defines the possible input types for configuration schemas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginConfigSchemaType {
    /// Represents boolean type with the default value.
    Boolean(bool),
    /// Represents numerical integer type with the default value.
    Integer(i32),
    /// Represents numerical floating type with the default value.
    Float(f32),
    /// Represents a text type with the default value.
    Text(String),
    /// Represents a list of directories.
    Directories,
    /// Represents a list of types with the given allowed file extensions (Empty to allow all).
    Files(Vec<String>),
    /// Represents Drop-down input type with a list of selectable options and the default value.
    Dropdown((Vec<String>, String)),
}

/// Represents the schema for a configuration item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginConfigSchemaItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub input_type: PluginConfigSchemaType,
}

/// Represents an installed plugin entity informations and configurations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginEntity {
    /// Directory path of the plugin. Qualify as ID for the plugin.
    pub dir_path: PathBuf,
    /// Represents the plugin type.
    pub plugin_type: PluginType,
    /// Include various information about the plugin.
    pub info: PluginInfo,
    /// Provides Plugins Metadata from separate source than the plugin binary.
    /// Currently they are saved inside plugin `*.toml` file.
    pub metadata: PluginMetadata,
    /// Path of the readme file for the plugin to be rendered on the front-end
    pub readme_path: Option<PathBuf>,
}

/// Represents different levels of logging severity for a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginLogLevel {
    /// Represents an error message.
    Err,
    /// Represents a warning message.
    Warn,
    /// Represents a debug message, used for development and troubleshooting.
    Debug,
    /// Represents an informational message.
    Info,
}

/// Represents a log message generated by a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginLogMessage {
    /// The severity level of the log message.
    pub level: PluginLogLevel,
    /// The timestamp of when the log message was generated, represented as a Unix timestamp.
    pub timestamp: u64,
    /// The actual content of the log message.
    pub msg: String,
}

/// Maintains the state of a plugin, including its log messages.
/// Represented as a struct (but not just a vector) to reserve
/// a space for a future fields.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginRunData {
    /// A collection of log messages associated with the plugin.
    pub logs: Vec<PluginLogMessage>,
}

/// Represents the informations of an invalid plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct InvalidPluginEntity {
    /// Directory path of the plugin. Qualify as ID for the plugin.
    pub dir_path: PathBuf,
    /// Represents the plugin type.
    pub plugin_type: PluginType,
}

/// Represents the plugins metadata like title, description...
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginMetadata {
    pub title: String,
    pub description: Option<String>,
}

/// Represents plugins main types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginType {
    Parser,
    ByteSource,
    Producer,
}

/// Contains the infos and options for a valid plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginInfo {
    pub wasm_file_path: PathBuf,
    pub api_version: SemanticVersion,
    pub plugin_version: SemanticVersion,
    pub config_schemas: Vec<PluginConfigSchemaItem>,
    pub render_options: RenderOptions,
}

/// Represents the semantic version used in the plugins system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct SemanticVersion {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
}

/// Represents the render options (columns headers, etc.) for the plugins.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum RenderOptions {
    Parser(Box<ParserRenderOptions>),
    ByteSource,
    Producer(Box<ProducerRenderOptions>),
}

/// Provides additional information to be rendered in the log view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct ParserRenderOptions {
    /// Rendering information for the column if log messages have multiple columns.
    ///
    /// # Note:
    /// The count of the provided columns must match the count of the columns of each log message as well.
    pub columns_options: Option<ColumnsRenderOptions>,
}

/// Represents the options needs to render columns information if they exist.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct ColumnsRenderOptions {
    /// List of columns infos providing the needed information for each column in log view.
    ///
    /// Note: The count of this list must match the count of the column of each log message.
    pub columns: Vec<ColumnInfo>,
    /// Minimum column width.
    pub min_width: u16,
    /// Maximum column width.
    pub max_width: u16,
}

/// Represents the infos of a column that will be used in the render options.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct ColumnInfo {
    /// Header title to be rendered on the top of the column in log view.
    pub caption: String,
    /// Description to be shown as tooltip for the column.
    pub description: String,
    /// Width of column (-1) for unlimited.
    pub width: i16,
}

/// Represents a list of [`PluginEntity`].
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginsList(pub Vec<PluginEntity>);

/// Represents a list of [`InvalidPluginEntity`].
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct InvalidPluginsList(pub Vec<InvalidPluginEntity>);

/// Represents a list of [`InvalidPluginEntity`].
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginsPathsList(pub Vec<String>);

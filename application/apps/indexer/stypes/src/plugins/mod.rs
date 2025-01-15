#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

//TODO AAZ: Remove if still not used.
#[allow(unused)]
#[cfg(feature = "rustcore")]
pub use extending::*;

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
    //Check if Default implementation should be removed on General Setting once this temp is done.
    //TODO AAZ: Temp solution.
    #[serde(default)]
    pub general_settings: PluginParserGeneralSettings,
    pub plugin_configs: Vec<PluginConfigItem>,
}

/// General settings for all parsers as plugins
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
//TODO AAZ: Check if this is needed in the final solution
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

//TODO AAZ: Make sure this is needed
/// General settings for all byte-sources as plugins
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginByteSourceGeneralSettings {
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
    Boolean,
    Integer,
    Float,
    Text,
    /// A list of directories.
    Directories,
    /// A list of types with the given allowed extensions.
    Files(Vec<String>),
    /// Drop-down input type with a list of selectable options.
    Dropdown(Vec<String>),
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

/// Represents a plugin entity informations and configurations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginEntity {
    pub dir_path: PathBuf,
    pub plugin_type: PluginType,
    pub state: PluginState,
    pub metadata: Option<PluginMetadata>,
}

/// Represents the plugins metadata like name, description...
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginMetadata {
    pub name: String,
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
}

/// Represents the plugins states and their corresponding informations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginState {
    Active(Box<ValidPluginInfo>),
    Invalid(Box<InvalidPluginInfo>),
}

/// Contains the infos and options for a valid plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct ValidPluginInfo {
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

/// Contains the informations for an invalid plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct InvalidPluginInfo {
    /// Error message describing why the plugin is invalid.
    pub error_msg: String,
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

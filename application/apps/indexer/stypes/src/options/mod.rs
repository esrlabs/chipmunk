#[cfg(feature = "nodejs")]
mod nodejs;

use crate::*;
// TODOs and open topics
// ## Validation of fields?
// Probably parser/source traites has to be update to have validation method
//
// ## Settings actions (like DLT stats)?
// Problematic places:
// - dlt stat
// - envvars (terminal command)

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct ComponentsOptions {
    pub source: Vec<FieldDesc>,
    pub parser: Vec<FieldDesc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub enum FieldDesc {
    Static(StaticFieldDesc),
    Lazy(LazyFieldDesc),
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct StaticFieldDesc {
    pub id: String,
    pub name: String,
    pub desc: String,
    pub required: bool,
    pub default: Option<Value>,
    pub interface: ValueInterface,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct LazyFieldDesc {
    pub id: String,
    pub name: String,
    pub desc: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct Field {
    pub id: String,
    pub value: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub enum Value {
    // Bool value field
    Boolean(bool),
    // Integer field
    Integer(i32),
    // Float number field
    Float(f32),
    // Text field
    Text(String),
    // List with value
    List(Vec<Value>),
    // List of folders
    Directories(Vec<PathBuf>),
    // List of files
    Files(Vec<PathBuf>),
    // Path to file
    File(PathBuf),
    // Path to directory
    Directory(PathBuf),
    // Keys with multiple values per key
    KeyValues(HashMap<String, Vec<String>>),
}

/// How value will be represented to user
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub enum ValueInterface {
    // Bool value field
    Boolean,
    // Integer field
    Integer,
    // Float number field
    Float,
    // Text field
    Text,
    // Dropdown list with known values
    DropList(Vec<Value>),
    // List with known values
    List(Vec<Value>),
    // Request to get list of folders
    RequestDirectories,
    // Request to get list of files
    RequestFiles,
    // Request to get folder's path
    RequestDirectory,
    // Request to get a file's path
    RequestFile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct FieldLoadingError {
    pub id: String,
    pub err: String,
}

/// Represents events sent to the client.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub enum CallbackOptionsEvent {
    /// Triggered when lazy field is ready
    LoadingDone {
        owner: Uuid,
        fields: Vec<StaticFieldDesc>,
    },

    /// Triggered when a lazy fields wasn't loaded.
    LoadingErrors {
        owner: Uuid,
        errors: Vec<FieldLoadingError>,
    },
    LoadingError {
        owner: Uuid,
        error: String,
        fields: Vec<String>,
    },
    LoadingCancelled {
        owner: Uuid,
        fields: Vec<String>,
    },
    Destroyed,
}

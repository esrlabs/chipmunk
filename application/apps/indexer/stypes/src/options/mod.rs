#[cfg(feature = "nodejs")]
mod nodejs;

use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct ComponentsOptionsList {
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "Map<string, FieldDesc[]>")
    )]
    pub options: HashMap<Uuid, Vec<FieldDesc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct FieldsValidationErrors {
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, string>"))]
    pub errors: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub struct ComponentOptions {
    pub fields: Vec<Field>,
    pub uuid: Uuid,
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
    pub interface: ValueInput,
    pub binding: Option<String>,
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
    pub binding: Option<String>,
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
pub enum ValueInput {
    Checkbox(bool),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    Number(i64),
    String(String),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "[Array<number>, number]")
    )]
    Numbers(Vec<i64>, i64),
    Strings(Vec<String>, String),
    NamedBools(Vec<(String, bool)>),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "Array<[string, number]>")
    )]
    NamedNumbers(Vec<(String, i64)>),
    NamedStrings(Vec<(String, String)>),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, number>"))]
    KeyNumber(HashMap<String, i64>),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "Map<string, number[]>")
    )]
    KeyNumbers(HashMap<String, Vec<i64>>),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, string>"))]
    KeyString(HashMap<String, String>),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "Map<string, string[]>")
    )]
    KeyStrings(HashMap<String, Vec<String>>),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "[Map<string, Map<string, Map<string, number>>>, Map<string, string>]")
    )]
    /// `HashMap<String, HashMap<String, HashMap<String, usize>>>` - table of data
    /// `HashMap<String, String>` - dictionary of headers
    NestedNumbersMap(
        HashMap<String, HashMap<String, HashMap<String, usize>>>,
        HashMap<String, String>,
    ),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "[Map<string, Map<string, Map<string, string>>>, Map<string, string>]")
    )]
    /// `HashMap<String, HashMap<String, HashMap<String, String>>>` - table of data
    /// `HashMap<String, String>` - dictionary of headers
    NestedStringsMap(
        HashMap<String, HashMap<String, HashMap<String, String>>>,
        HashMap<String, String>,
    ),
    Directories,
    Files(Vec<String>),
    File(Vec<String>),
    Directory,
    Bound {
        output: Box<ValueInput>,
        inputs: Vec<ValueInput>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "options.ts")
)]
pub enum Value {
    Boolean(bool),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    Number(i64),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Array<number>"))]
    Numbers(Vec<i64>),
    String(String),
    Strings(Vec<String>),
    Directories(Vec<PathBuf>),
    Files(Vec<PathBuf>),
    File(PathBuf),
    Directory(PathBuf),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, number>"))]
    KeyNumber(HashMap<String, i64>),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "Map<string, number[]>")
    )]
    KeyNumbers(HashMap<String, Vec<i64>>),
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, string>"))]
    KeyString(HashMap<String, String>),
    #[cfg_attr(
        all(test, feature = "test_and_gen"),
        ts(type = "Map<string, string[]>")
    )]
    KeyStrings(HashMap<String, Vec<String>>),
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

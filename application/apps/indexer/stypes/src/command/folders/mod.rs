#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[allow(clippy::upper_case_acronyms)]
#[derive(Clone, Serialize, Deserialize, Debug)]
// #[serde(tag = "type", content = "value")]
#[extend::encode_decode]
pub enum FolderEntityType {
    BlockDevice,
    CharacterDevice,
    Directory,
    FIFO,
    File,
    Socket,
    SymbolicLink,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct FolderEntityDetails {
    filename: String,
    full: String,
    path: String,
    basename: String,
    ext: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct FoldersScanningResult {
    pub list: Vec<FolderEntity>,
    pub max_len_reached: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct FolderEntity {
    name: String,
    fullname: String,
    kind: FolderEntityType,
    details: Option<FolderEntityDetails>,
}

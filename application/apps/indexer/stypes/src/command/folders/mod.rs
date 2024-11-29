#[cfg(any(test, feature = "rustcore"))]
mod extending;
#[cfg(any(test, feature = "nodejs"))]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[allow(clippy::upper_case_acronyms)]
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub enum FolderEntityType {
    BlockDevice = 0,
    CharacterDevice = 1,
    Directory = 2,
    FIFO = 3,
    File = 4,
    Socket = 5,
    SymbolicLink = 6,
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

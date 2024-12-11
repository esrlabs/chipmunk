#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

/// Represents the type of a folder entity in the file system.
#[allow(clippy::upper_case_acronyms)]
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/folders.ts", module = "folders")
)]
pub enum FolderEntityType {
    /// A block device (e.g., a disk or partition).
    BlockDevice,
    /// A character device (e.g., a terminal or serial port).
    CharacterDevice,
    /// A directory.
    Directory,
    /// A named pipe (FIFO).
    FIFO,
    /// A regular file.
    File,
    /// A socket.
    Socket,
    /// A symbolic link.
    SymbolicLink,
}

/// Contains detailed information about a folder entity.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/folders.ts", module = "folders")
)]
pub struct FolderEntityDetails {
    /// The name of the file or folder.
    filename: String,
    /// The full path to the file or folder.
    full: String,
    /// The directory path containing the file or folder.
    path: String,
    /// The base name of the file or folder.
    basename: String,
    /// The file extension, if applicable.
    ext: String,
}

/// Represents the result of scanning a folder.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/folders.ts", module = "folders")
)]
pub struct FoldersScanningResult {
    /// A list of folder entities found during the scan.
    pub list: Vec<FolderEntity>,
    /// Indicates whether the maximum length of results was reached.
    pub max_len_reached: bool,
}

/// Represents a folder entity in the file system.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/folders.ts", module = "folders")
)]
pub struct FolderEntity {
    /// The name of the entity (file or folder).
    name: String,
    /// The full path of the entity.
    fullname: String,
    /// The type of the entity (e.g., file, directory, symbolic link).
    kind: FolderEntityType,
    /// Optional detailed information about the entity.
    details: Option<FolderEntityDetails>,
}

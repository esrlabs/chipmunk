use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct AttachmentInfo {
    pub uuid: Uuid,
    // This entity will be propagated into JS world side, to avoid unusual naming file_path,
    // would be used filepath instead
    pub filepath: PathBuf,
    pub name: String,
    pub ext: Option<String>,
    pub size: usize,
    pub mime: Option<String>,
    pub messages: Vec<usize>,
}

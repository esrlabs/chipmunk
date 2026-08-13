use mime_guess;
use parsers::{self};
use std::{
    fs::{File, create_dir},
    io,
    io::Write,
    path::{Path, PathBuf},
};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum AttachmentsError {
    #[error("Failed to store attachment {name:?}: {source}")]
    Store { name: String, source: io::Error },
    #[error("Session isn't created")]
    SessionNotCreated,
}

const FILE_NAME_INDEXES_LIMIT: usize = 1000;
const ALLOWED_FILENAME_CHARS: &[char] = &['-', '_'];

fn get_valid_file_path(dest: &Path, origin: &str) -> Result<PathBuf, io::Error> {
    fn sanitize<S: AsRef<str>>(input: S) -> String {
        input
            .as_ref()
            .chars()
            .map(|ch| {
                if ch.is_alphanumeric() || ALLOWED_FILENAME_CHARS.contains(&ch) {
                    ch
                } else {
                    '_'
                }
            })
            .collect()
    }
    let origin_path = PathBuf::from(origin);
    let origin_file_name = PathBuf::from(origin_path.file_name().ok_or(io::Error::other(
        format!("Cannot get file name from {origin:?}"),
    ))?);
    let basename = sanitize(
        origin_file_name
            .file_stem()
            .ok_or(io::Error::other("Fail to parse origin attachment path"))?
            .to_string_lossy(),
    );
    let extension = origin_file_name.extension();
    let mut index: usize = 0;
    loop {
        let mut suggestion = if index == 0 {
            dest.join(PathBuf::from(&basename))
        } else {
            dest.join(PathBuf::from(format!("{basename}_{index}")))
        };
        if let Some(extension) = extension {
            suggestion = PathBuf::from(format!(
                "{}.{}",
                suggestion.to_string_lossy(),
                sanitize(extension.to_string_lossy())
            ));
        }
        if !suggestion.exists() {
            return Ok(suggestion);
        } else {
            index += 1;
        }
        if index > FILE_NAME_INDEXES_LIMIT {
            return Err(io::Error::other(format!(
                "Cannot find suitable file name for {origin}"
            )));
        }
    }
}

/// Writes the payload of `origin` into `store_folder`, creating the folder when it's missing.
///
/// # Return:
/// The path of the created file.
fn write_attachment_file(
    origin: &parsers::Attachment,
    store_folder: &Path,
) -> Result<PathBuf, io::Error> {
    if !store_folder.exists() {
        create_dir(store_folder)?;
    }
    let attachment_path = get_valid_file_path(store_folder, &origin.name)?;
    let mut attachment_file = File::create(&attachment_path)?;
    attachment_file.write_all(&origin.data)?;

    Ok(attachment_path)
}

#[derive(Debug)]
pub struct Attachments {
    /// Descriptions of the stored attachments in the order they have been stored.
    attachments: Vec<stypes::AttachmentInfo>,
    dest: Option<PathBuf>,
}

impl Attachments {
    pub fn new() -> Self {
        Attachments {
            attachments: Vec::new(),
            dest: None,
        }
    }

    pub fn set_dest_path(&mut self, dest: PathBuf) -> bool {
        if let (Some(parent), Some(file_stem)) = (dest.parent(), dest.file_stem()) {
            let dest = parent.join(file_stem);
            self.dest = Some(dest);
            true
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        self.attachments.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Stores the payload of the given attachment on disk and keeps its description.
    pub fn add(
        &mut self,
        origin: parsers::Attachment,
    ) -> Result<stypes::AttachmentInfo, AttachmentsError> {
        let Some(dest) = self.dest.as_ref() else {
            return Err(AttachmentsError::SessionNotCreated);
        };

        // The attachment name is cloned in the error path only, keeping the success path
        // free of extra allocations.
        let attachment_path =
            write_attachment_file(&origin, dest).map_err(|source| AttachmentsError::Store {
                name: origin.name.clone(),
                source,
            })?;

        let attachment = stypes::AttachmentInfo {
            uuid: Uuid::new_v4(),
            filepath: attachment_path,
            name: origin.name.clone(),
            ext: Path::new(&origin.name)
                .extension()
                .map(|ex| ex.to_string_lossy().to_string()),
            size: origin.size,
            mime: mime_guess::from_path(origin.name)
                .first()
                .map(|guess| guess.to_string()),
            messages: origin.messages,
        };

        self.attachments.push(attachment.clone());

        Ok(attachment)
    }

    /// All the stored attachments in the order they have been stored.
    pub fn attachments(&self) -> &[stypes::AttachmentInfo] {
        &self.attachments
    }
}

impl Default for Attachments {
    fn default() -> Self {
        Self::new()
    }
}

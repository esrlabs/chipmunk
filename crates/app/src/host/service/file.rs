//! Utilities for file handling and directory scanning within the host service.
//!
//! This module provides functions to detect file formats based on content and extension,
//! scan directories for specific file types, and format file sizes for user display.

use std::{
    ffi::OsStr,
    fs, io,
    path::{Path, PathBuf},
};

use stypes::{FileFormat, NativeError, NativeErrorKind, Severity};
use walkdir::WalkDir;

use crate::host::{command::CopyFileInfo, error::HostError};

/// Maximum directory depth visited while scanning, relative to the scanned root.
const SCAN_MAX_DEPTH: usize = 10;

/// Maximum count of matching files collected by one scan. Each file can end up in its
/// own session, therefore the limit keeps the results manageable for the app and the user.
const SCAN_MAX_FILES: usize = 500;

/// Detects the [`FileFormat`] of a file at the given path.
pub fn detect_file_format(file_path: &Path) -> io::Result<FileFormat> {
    if file_tools::is_utf8_text(file_path)? {
        return Ok(FileFormat::Text);
    }

    let format = match file_path.extension() {
        Some(ext) if ext.eq_ignore_ascii_case("pcap") => FileFormat::PcapLegacy,
        Some(ext) if ext.eq_ignore_ascii_case("pcapng") => FileFormat::PcapNG,
        // Text content which isn't valid UTF-8 is opened all the same: the session decodes it
        // lossily instead of refusing the file.
        Some(ext) if is_text_extension(ext) => FileFormat::Text,
        _ => FileFormat::Binary,
    };

    Ok(format)
}

fn is_text_extension(extension: &OsStr) -> bool {
    [
        "txt", "log", "csv", "json", "xml", "md", "yaml", "yml", "toml",
    ]
    .into_iter()
    .any(|text_extension| extension.eq_ignore_ascii_case(text_extension))
}

/// Files collected by [`scan_dir`] with the limits that stopped the scan early.
#[derive(Debug, Default)]
pub struct DirScan {
    pub files: Vec<PathBuf>,
    /// Subdirectories below the depth limit haven't been visited.
    depth_limited: bool,
    /// Scan stopped after reaching the limit of matching files.
    count_limited: bool,
}

impl DirScan {
    /// Message about the applied scan limits, to be shown to the user when the scan
    /// didn't cover the whole directory tree.
    pub fn limits_message(&self) -> Option<String> {
        let mut limits = Vec::new();

        if self.depth_limited {
            limits.push(format!(
                "subfolders deeper than {SCAN_MAX_DEPTH} levels were skipped"
            ));
        }

        if self.count_limited {
            limits.push(format!(
                "only the first {SCAN_MAX_FILES} matching files were collected"
            ));
        }

        if limits.is_empty() {
            return None;
        }

        Some(format!("Folder scan was limited: {}.", limits.join(", ")))
    }
}

/// Scans a directory tree for files matching the specified [`FileFormat`].
///
/// Symbolic links are never followed, and the scan stops on the configured depth and
/// file count limits.
pub fn scan_dir(dir_path: &Path, target_format: FileFormat) -> io::Result<DirScan> {
    let mut scan = DirScan::default();

    for entry in WalkDir::new(dir_path)
        .max_depth(SCAN_MAX_DEPTH)
        .sort_by_file_name()
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                // Errors on the root make the whole scan pointless, while errors on the
                // entries below it affect the failing entry only.
                if err.depth() == 0 {
                    let error = err
                        .into_io_error()
                        .unwrap_or_else(|| io::Error::other("Directory scan failed"));

                    return Err(error);
                }

                log::warn!("Entry will be skipped while scanning directory. Error: {err}");
                continue;
            }
        };

        // Directories on the maximal depth are yielded but never visited.
        if entry.depth() == SCAN_MAX_DEPTH && entry.file_type().is_dir() {
            scan.depth_limited = true;
            continue;
        }

        // Symbolic links are excluded here too, since their file type is never a file.
        if !entry.file_type().is_file() || !matches_format(entry.path(), target_format) {
            continue;
        }

        if scan.files.len() == SCAN_MAX_FILES {
            scan.count_limited = true;
            break;
        }

        scan.files.push(entry.into_path());
    }

    Ok(scan)
}

/// Checks if the file matches the target format, pruning by extension first to avoid
/// reading the content of the files which can't match.
fn matches_format(path: &Path, target_format: FileFormat) -> bool {
    let required_extension = match target_format {
        // Binary is used here for DLT files only to match the behavior of master branch.
        FileFormat::Binary => Some("dlt"),
        FileFormat::PcapNG => Some("pcapng"),
        FileFormat::PcapLegacy => Some("pcap"),
        FileFormat::Text => None,
    };

    if let Some(extension) = required_extension
        && !path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case(extension))
    {
        return false;
    }

    detect_file_format(path)
        .inspect_err(|err| {
            log::warn!(
                "Error while checking file type. File will be skipped. \
                    Path: {}. Error {err:?}",
                path.display()
            )
        })
        .is_ok_and(|format| format == target_format)
}

pub async fn copy_files(copy_file_infos: Vec<CopyFileInfo>) -> Result<(), HostError> {
    let mut errors = Vec::new();

    for copy_file_info in copy_file_infos {
        if let Err(error) = copy_file(copy_file_info.source, copy_file_info.destination).await {
            errors.push(format!("Error while copying file: {error}",));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(HostError::NativeError(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Failed to copy {} files: {}\n ",
                errors.len(),
                errors.join("\n ")
            )),
        }))
    }
}

pub async fn copy_file(source: PathBuf, destination: PathBuf) -> Result<(), io::Error> {
    let copy_result = tokio::task::spawn_blocking(move || fs::copy(&source, &destination)).await;

    match copy_result {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(err)) => Err(err),
        Err(join_err) => Err(io::Error::other(join_err)),
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use super::*;

    #[test]
    fn detect_utf8_text_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("log.txt");
        fs::write(&path, "plain text\n").unwrap();

        assert_eq!(detect_file_format(&path).unwrap(), FileFormat::Text);
    }

    #[test]
    fn detect_text_by_extension_despite_encoding() {
        for extension in [
            "txt", "log", "csv", "json", "xml", "md", "yaml", "yml", "toml",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join(format!("encoded.{extension}"));
            fs::write(&path, [0xff, 0xfe, b'a', 0x00]).unwrap();

            assert_eq!(detect_file_format(&path).unwrap(), FileFormat::Text);
        }
    }

    #[test]
    fn detect_binary_for_non_text_extension() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("payload.bin");
        fs::write(&path, [0xff, 0xfe, b'a', 0x00]).unwrap();

        assert_eq!(detect_file_format(&path).unwrap(), FileFormat::Binary);
    }

    #[test]
    fn detect_pcap_formats_before_text_extensions() {
        let dir = tempfile::tempdir().unwrap();
        let pcap = write_non_utf8_file(dir.path(), "capture.pcap");
        let pcapng = write_non_utf8_file(dir.path(), "capture.pcapng");

        assert_eq!(detect_file_format(&pcap).unwrap(), FileFormat::PcapLegacy);
        assert_eq!(detect_file_format(&pcapng).unwrap(), FileFormat::PcapNG);
    }

    fn write_non_utf8_file(dir: &Path, file_name: &str) -> PathBuf {
        let path = dir.join(file_name);
        fs::write(&path, [0xff, 0xfe, b'a', 0x00]).unwrap();
        path
    }

    #[test]
    fn scan_collects_text_files_from_subfolders() {
        let dir = tempfile::tempdir().unwrap();
        let session = dir.path().join("session_a").join("nested");
        fs::create_dir_all(&session).unwrap();

        let root_file = dir.path().join("root_trace.txt");
        fs::write(&root_file, "root\n").unwrap();
        let nested_file = session.join("trace_1.log");
        fs::write(&nested_file, "nested\n").unwrap();
        write_non_utf8_file(&session, "trace_2.dlt");

        let scan = scan_dir(dir.path(), FileFormat::Text).unwrap();

        assert_eq!(scan.files, vec![root_file, nested_file]);
        assert!(scan.limits_message().is_none());
    }

    #[test]
    fn scan_collects_dlt_files_from_subfolders() {
        let dir = tempfile::tempdir().unwrap();
        let session = dir.path().join("session_a").join("nested");
        fs::create_dir_all(&session).unwrap();

        let root_file = write_non_utf8_file(dir.path(), "root_trace.dlt");
        let nested_file = write_non_utf8_file(&session, "trace_1.dlt");
        write_non_utf8_file(&session, "payload.bin");
        fs::write(session.join("trace_2.txt"), "text\n").unwrap();

        let scan = scan_dir(dir.path(), FileFormat::Binary).unwrap();

        assert_eq!(scan.files, vec![root_file, nested_file]);
        assert!(scan.limits_message().is_none());
    }
}

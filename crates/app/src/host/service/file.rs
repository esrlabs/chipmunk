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

use crate::host::{command::CopyFileInfo, error::HostError};

/// Result of detecting whether a file can be opened by a built-in source format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileFormatDetection {
    /// The file can be opened as the contained format.
    Supported(FileFormat),
    /// The file extension indicates text, but the content is not valid UTF-8.
    UnsupportedTextEncoding,
}

/// Detects the [`FileFormat`] of a file at the given path.
pub fn detect_file_format(file_path: &Path) -> io::Result<FileFormatDetection> {
    if file_tools::is_utf8_text(file_path)? {
        return Ok(FileFormatDetection::Supported(FileFormat::Text));
    }

    let extension = file_path.extension();
    let detection = match extension {
        Some(ext) if ext.eq_ignore_ascii_case("pcap") => {
            FileFormatDetection::Supported(FileFormat::PcapLegacy)
        }
        Some(ext) if ext.eq_ignore_ascii_case("pcapng") => {
            FileFormatDetection::Supported(FileFormat::PcapNG)
        }
        Some(ext) if is_text_extension(ext) => FileFormatDetection::UnsupportedTextEncoding,
        _ => FileFormatDetection::Supported(FileFormat::Binary),
    };

    Ok(detection)
}

fn is_text_extension(extension: &OsStr) -> bool {
    [
        "txt", "log", "csv", "json", "xml", "md", "yaml", "yml", "toml",
    ]
    .into_iter()
    .any(|text_extension| extension.eq_ignore_ascii_case(text_extension))
}

/// Builds the user-facing message for text files with unsupported encoding.
pub fn unsupported_text_encoding_message(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Selected file");
    format!(
        "{name} appears to be a text file, but its encoding is not supported. \
        Chipmunk currently supports UTF-8 text files only."
    )
}

/// Scans a directory for files matching the specified [`FileFormat`].
pub fn scan_dir(dir_path: &Path, target_format: FileFormat) -> io::Result<Vec<PathBuf>> {
    let files = std::fs::read_dir(dir_path)?
        .filter_map(|r| r.ok().map(|e| e.path()))
        .filter(|e| e.is_file())
        .filter(|path| {
            detect_file_format(path)
                .inspect_err(|err| {
                    log::warn!(
                        "Error while checking file type. File will be skipped. \
                            Path: {}. Error {err:?}",
                        path.display()
                    )
                })
                .is_ok_and(|detection| match detection {
                    FileFormatDetection::Supported(format) => {
                        if target_format == FileFormat::Binary {
                            // Binary is used here for DLT files only to match the behavior
                            // of master branch.
                            format == target_format
                                && path
                                    .extension()
                                    .is_some_and(|ext| ext.eq_ignore_ascii_case("dlt"))
                        } else {
                            format == target_format
                        }
                    }
                    FileFormatDetection::UnsupportedTextEncoding => {
                        log::warn!(
                            "Unsupported text encoding. File will be skipped. Path: {}",
                            path.display()
                        );
                        false
                    }
                })
        })
        .collect();

    Ok(files)
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

        assert_eq!(
            detect_file_format(&path).unwrap(),
            FileFormatDetection::Supported(FileFormat::Text)
        );
    }

    #[test]
    fn detect_unsupported_text_encoding_by_extension() {
        for extension in [
            "txt", "log", "csv", "json", "xml", "md", "yaml", "yml", "toml",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join(format!("encoded.{extension}"));
            fs::write(&path, [0xff, 0xfe, b'a', 0x00]).unwrap();

            assert_eq!(
                detect_file_format(&path).unwrap(),
                FileFormatDetection::UnsupportedTextEncoding
            );
        }
    }

    #[test]
    fn detect_binary_for_non_text_extension() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("payload.bin");
        fs::write(&path, [0xff, 0xfe, b'a', 0x00]).unwrap();

        assert_eq!(
            detect_file_format(&path).unwrap(),
            FileFormatDetection::Supported(FileFormat::Binary)
        );
    }

    #[test]
    fn detect_pcap_formats_before_text_encoding_diagnostic() {
        let dir = tempfile::tempdir().unwrap();
        let pcap = write_non_utf8_file(dir.path(), "capture.pcap");
        let pcapng = write_non_utf8_file(dir.path(), "capture.pcapng");

        assert_eq!(
            detect_file_format(&pcap).unwrap(),
            FileFormatDetection::Supported(FileFormat::PcapLegacy)
        );
        assert_eq!(
            detect_file_format(&pcapng).unwrap(),
            FileFormatDetection::Supported(FileFormat::PcapNG)
        );
    }

    fn write_non_utf8_file(dir: &Path, file_name: &str) -> PathBuf {
        let path = dir.join(file_name);
        fs::write(&path, [0xff, 0xfe, b'a', 0x00]).unwrap();
        path
    }
}

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
                .is_ok_and(|format| {
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
}

//! Utilities for file handling and directory scanning within the host service.
//!
//! This module provides functions to detect file formats based on content and extension,
//! scan directories for specific file types, and format file sizes for user display.

use std::{
    io,
    path::{Path, PathBuf},
};

use stypes::FileFormat;

/// Detects the [`FileFormat`] of a file at the given path.
pub fn get_file_format(file_path: &Path) -> io::Result<FileFormat> {
    let is_binary = file_tools::is_binary(file_path)?;

    if is_binary {
        let extension = file_path.extension();
        // Open session setup view for binary files.
        let format = match extension {
            Some(ext) if ext.eq_ignore_ascii_case("pcap") => FileFormat::PcapLegacy,
            Some(ext) if ext.eq_ignore_ascii_case("pcapng") => FileFormat::PcapNG,
            _ => FileFormat::Binary,
        };

        Ok(format)
    } else {
        Ok(FileFormat::Text)
    }
}

/// Scans a directory for files matching the specified [`FileFormat`].
pub fn scan_dir(dir_path: &Path, target_format: FileFormat) -> io::Result<Vec<PathBuf>> {
    let files = std::fs::read_dir(dir_path)?
        .filter_map(|r| r.ok().map(|e| e.path()))
        .filter(|e| e.is_file())
        .filter(|path| {
            get_file_format(path)
                .inspect_err(|err| {
                    log::warn!(
                        "Error while checking file type. File will be skipped. \
                            Path: {}. Error {err:?}",
                        path.display()
                    )
                })
                .is_ok_and(|f| {
                    if target_format == FileFormat::Binary {
                        // Binary is used here for DLT files only to match the behavior
                        // of master branch.
                        f == target_format
                            && path
                                .extension()
                                .is_some_and(|ext| ext.eq_ignore_ascii_case("dlt"))
                    } else {
                        f == target_format
                    }
                })
        })
        .collect();

    Ok(files)
}

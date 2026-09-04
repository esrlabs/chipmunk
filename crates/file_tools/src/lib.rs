//! Utilities for lightweight file content classification.

use std::{
    fs::File,
    io::{Read, Result},
    path::Path,
    str::from_utf8,
};

const BYTES_TO_READ: u64 = 10240;

/// Returns whether the beginning of the file is valid UTF-8 text.
///
/// Only the first [`BYTES_TO_READ`] bytes are looked at, and a character which the read limit
/// cuts in half still counts as valid: an incomplete sequence at the end of a prefix says nothing
/// about the file. Files shorter than the limit are read whole, so there a broken tail is real
/// content and counts as invalid.
pub fn is_utf8_text(file_path: impl AsRef<Path>) -> Result<bool> {
    let buffer = fetch_starting_chunk(file_path.as_ref())?;
    let is_text = match from_utf8(&buffer) {
        Ok(_) => true,
        // `error_len() == None` means the input ends mid-character.
        Err(err) => buffer.len() as u64 == BYTES_TO_READ && err.error_len().is_none(),
    };
    Ok(is_text)
}

fn fetch_starting_chunk(file_path: &Path) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    File::open(file_path)?
        .take(BYTES_TO_READ)
        .read_to_end(&mut buffer)?;
    Ok(buffer)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_fetch_starting_chunk() -> Result<()> {
        let chunks: Vec<u8> =
            fetch_starting_chunk(Path::new("../../development/resources/chinese_poem.txt"))?;
        assert_eq!(chunks[0..5], [32, 32, 32, 32, 229]);
        Ok(())
    }

    #[test]
    fn test_fetch_starting_chunk_when_file_is_missing() -> Result<()> {
        assert!(
            fetch_starting_chunk(Path::new(
                "../../development/resources/missing_chinese_poem.txt"
            ))
            .is_err()
        );
        Ok(())
    }

    #[test]
    fn test_fetch_starting_chunk_when_file_is_empty() -> Result<()> {
        let chunks: Vec<u8> =
            fetch_starting_chunk(Path::new("../../development/resources/empty.txt"))?;
        assert_eq!(chunks, []);
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_file_is_binary() -> Result<()> {
        assert!(!is_utf8_text(String::from(
            "../../development/resources/attachments.dlt"
        ))?);
        assert!(!is_utf8_text(String::from(
            "../../development/resources/someip/udp/someip.pcap"
        ))?);
        assert!(!is_utf8_text(String::from(
            "../../development/resources/someip/udp/someip.pcapng"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_file_is_text() -> Result<()> {
        assert!(is_utf8_text(String::from(
            "../../development/resources/chinese_poem.txt"
        ))?);
        assert!(is_utf8_text(String::from(
            "../../development/resources/sample_utf_8.txt"
        ))?);
        assert!(is_utf8_text(String::from(
            "../../development/resources/someip/someip.xml"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_wrong_file_path_is_given() -> Result<()> {
        assert!(is_utf8_text(String::from("../../development/resources/empty.text")).is_err());
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_file_is_empty() -> Result<()> {
        assert!(is_utf8_text(String::from(
            "../../development/resources/empty.txt"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_character_is_split_by_the_read_limit() -> Result<()> {
        // Three bytes per character, so the read limit can't land on a character boundary.
        assert_ne!(BYTES_TO_READ % 3, 0);
        let path = temp_path("split_character");
        std::fs::write(&path, "日".repeat(BYTES_TO_READ as usize))?;

        let result = is_utf8_text(&path);
        std::fs::remove_file(&path)?;

        assert!(result?);
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_whole_file_ends_mid_character() -> Result<()> {
        let path = temp_path("broken_tail");
        // The lead byte of a three-byte character, with the rest of it missing.
        std::fs::write(&path, [0xe6])?;

        let result = is_utf8_text(&path);
        std::fs::remove_file(&path)?;

        assert!(!result?);
        Ok(())
    }

    #[test]
    fn test_is_utf8_text_when_single_byte_is_invalid_utf8() -> Result<()> {
        let path = temp_path("invalid_byte");
        std::fs::write(&path, [0xff])?;

        let result = is_utf8_text(&path);
        std::fs::remove_file(&path)?;

        assert!(!result?);
        Ok(())
    }

    /// Path for a file of the test named `name`, unique per test and per test run, since tests
    /// share the temp directory and run in parallel.
    fn temp_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "chipmunk_file_tools_{}_{name}.bin",
            std::process::id(),
        ))
    }
}

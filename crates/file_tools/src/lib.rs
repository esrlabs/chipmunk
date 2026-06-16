//! Utilities for lightweight file content classification.

use std::{
    fs::File,
    io::{Read, Result},
    path::Path,
    str::from_utf8,
};

const BYTES_TO_READ: u64 = 10240;

/// Returns whether the beginning of the file is valid UTF-8 text.
pub fn is_utf8_text(file_path: impl AsRef<Path>) -> Result<bool> {
    let buffer = fetch_starting_chunk(file_path.as_ref())?;
    let is_text = from_utf8(&buffer).is_ok();
    Ok(is_text)
}

/// Returns whether the beginning of the file is not valid UTF-8 text.
pub fn is_binary(file_path: impl AsRef<Path>) -> Result<bool> {
    let is_binary = !is_utf8_text(file_path)?;
    Ok(is_binary)
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
    fn test_is_binary_when_file_is_binary() -> Result<()> {
        assert!(is_binary(String::from(
            "../../development/resources/attachments.dlt"
        ))?);
        assert!(is_binary(String::from(
            "../../development/resources/someip/udp/someip.pcap"
        ))?);
        assert!(is_binary(String::from(
            "../../development/resources/someip/udp/someip.pcapng"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_file_is_not_binary() -> Result<()> {
        assert!(!is_binary(String::from(
            "../../development/resources/chinese_poem.txt"
        ))?);
        assert!(!is_binary(String::from(
            "../../development/resources/sample_utf_8.txt"
        ))?);
        assert!(!is_binary(String::from(
            "../../development/resources/someip/someip.xml"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_wrong_file_path_is_given() -> Result<()> {
        assert!(is_binary(String::from("../../development/resources/empty.text")).is_err());
        Ok(())
    }

    #[test]
    fn test_is_binary_when_file_is_empty() -> Result<()> {
        assert!(!is_binary(String::from(
            "../../development/resources/empty.txt"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_single_byte_is_invalid_utf8() -> Result<()> {
        let path = std::env::temp_dir().join(format!(
            "chipmunk_invalid_utf8_{}_{}.bin",
            std::process::id(),
            line!()
        ));
        std::fs::write(&path, [0xff])?;

        let result = is_binary(&path);
        std::fs::remove_file(&path)?;

        assert!(result?);
        Ok(())
    }
}

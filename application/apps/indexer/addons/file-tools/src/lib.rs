use std::{
    fs::{File, metadata},
    io::{Read, Result},
    path::Path,
    str::from_utf8,
};

const BYTES_TO_READ: u64 = 10240;

pub fn is_binary(file_path: impl AsRef<Path>) -> Result<bool> {
    let buffer = fetch_starting_chunk(file_path.as_ref())?;
    Ok(from_utf8(&buffer).map_or(true, |_file_content| false))
}

fn fetch_starting_chunk(file_path: &Path) -> Result<Vec<u8>> {
    let bytes_to_read: u64 = (metadata(file_path)?.len().max(1) - 1).min(BYTES_TO_READ);

    let mut buffer = Vec::new();
    File::open(file_path)?
        .take(bytes_to_read)
        .read_to_end(&mut buffer)?;
    Ok(buffer)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_fetch_starting_chunk() -> Result<()> {
        let chunks: Vec<u8> = fetch_starting_chunk(Path::new(
            "../../../../developing/resources/chinese_poem.txt",
        ))?;
        assert_eq!(chunks[0..5], [32, 32, 32, 32, 229]);
        Ok(())
    }

    #[test]
    fn test_fetch_starting_chunk_when_file_is_missing() -> Result<()> {
        assert!(
            fetch_starting_chunk(Path::new("../../developing/resources/chinese_poem.txt")).is_err()
        );
        Ok(())
    }

    #[test]
    fn test_fetch_starting_chunk_when_file_is_empty() -> Result<()> {
        let chunks: Vec<u8> =
            fetch_starting_chunk(Path::new("../../../../developing/resources/empty.txt"))?;
        assert_eq!(chunks, []);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_file_is_binary() -> Result<()> {
        assert!(is_binary(String::from(
            "../../../../developing/resources/attachments.dlt"
        ))?);
        assert!(is_binary(String::from(
            "../../../../developing/resources/someip.pcap"
        ))?);
        assert!(is_binary(String::from(
            "../../../../developing/resources/someip.pcapng"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_file_is_not_binary() -> Result<()> {
        assert!(!is_binary(String::from(
            "../../../../developing/resources/chinese_poem.txt"
        ))?);
        assert!(!is_binary(String::from(
            "../../../../developing/resources/sample_utf_8.txt"
        ))?);
        assert!(!is_binary(String::from(
            "../../../../developing/resources/someip.xml"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_wrong_file_path_is_given() -> Result<()> {
        assert!(is_binary(String::from("../../developing/resources/empty.text")).is_err());
        Ok(())
    }

    #[test]
    fn test_is_binary_when_file_is_empty() -> Result<()> {
        assert!(!is_binary(String::from(
            "../../../../developing/resources/empty.txt"
        ))?);
        Ok(())
    }
}

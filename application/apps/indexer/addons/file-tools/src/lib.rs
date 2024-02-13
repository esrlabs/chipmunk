use anyhow::Result;
use std::{
    fs::{metadata, File},
    io::Read,
    path::Path,
    str::from_utf8,
};

const BYTES_TO_READ: u64 = 10240;

pub fn is_binary(file_path: String) -> Result<bool> {
    let chunks = fetch_starting_chunk(Path::new(&file_path));
    let buffer = match chunks {
        Ok(buffer) => buffer,
        Err(err) => return Err(err),
    };

    let result = from_utf8(&buffer);
    match result {
        Ok(_file_content) => Ok(false),
        Err(_err) => Ok(true),
    }
}

fn fetch_starting_chunk(file_path: &Path) -> Result<Vec<u8>> {
    let file = File::open(file_path)?;
    let file_length: u64 = metadata(file_path)?.len();
    let file_length: u64 = if file_length == 0 {
        file_length
    } else {
        file_length - 1
    };
    let file_length = if BYTES_TO_READ < file_length {
        BYTES_TO_READ
    } else {
        file_length
    };

    let mut file = file.take(file_length);
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
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

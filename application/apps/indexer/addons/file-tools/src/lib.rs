use anyhow::Result;
use std::{
    fs::{metadata, File},
    io::Read,
    path::Path,
    str::from_utf8,
};

const BYTES_TO_READ: u64 = 10240;

pub fn is_binary(file_path: &Path) -> Result<bool> {
    let chunks = fetch_starting_chunk(file_path);
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
    let file_length: u64 = metadata(file_path)?.len() - 1;
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
    fn test_is_binary_when_file_is_binary() -> Result<()> {
        assert!(is_binary(Path::new(
            "../../../../developing/resources/attachments.dlt"
        ))?);
        assert!(is_binary(Path::new(
            "../../../../developing/resources/someip.pcap"
        ))?);
        assert!(is_binary(Path::new(
            "../../../../developing/resources/someip.pcapng"
        ))?);
        Ok(())
    }

    #[test]
    fn test_is_binary_when_file_is_not_binary() -> Result<()> {
        assert!(!is_binary(Path::new(
            "../../../../developing/resources/chinese_poem.txt"
        ))?);
        assert!(!is_binary(Path::new(
            "../../../../developing/resources/sample_utf_8.txt"
        ))?);
        assert!(!is_binary(Path::new(
            "../../../../developing/resources/someip.xml"
        ))?);
        Ok(())
    }
}

use std::io::{Read, Seek};

#[derive(Debug, Clone, Default)]
/// Mock Class that provide different byte on each read call filling the whole given buffer with it
pub struct MockRead {
    current_byte: u8,
}

impl Read for MockRead {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        buf.fill(self.current_byte);

        self.current_byte = self.current_byte.wrapping_add(1);

        Ok(buf.len())
    }
}

impl Seek for MockRead {
    fn seek(&mut self, _pos: std::io::SeekFrom) -> std::io::Result<u64> {
        panic!("Seek isn't called anywhere where MockRead is used yet");
    }
}

#[derive(Debug, Clone)]
/// Mock Class that provide the given data an each read call.
pub struct MockRepeatRead {
    data: Vec<u8>,
}

impl MockRepeatRead {
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }
}

impl Read for MockRepeatRead {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        Read::read(&mut self.data.as_slice(), buf)
    }
}

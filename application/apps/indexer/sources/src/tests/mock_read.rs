use std::io::Read;

#[derive(Debug, Clone, Default)]
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

#[derive(Debug, Clone)]
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

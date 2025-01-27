// Copyright (c) 2025 ESR Labs GmbH. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.

use std::{
    cmp::min,
    io::{BufRead, Read, Result, Seek, SeekFrom},
    ptr::copy,
};

/// A buffered reader that could refill while still some remaining data is stored.
pub struct BufReader<R> {
    reader: R,
    buffer: DeqBuffer,
    min: usize,
}

impl<R> BufReader<R> {
    /// Creates a new reader with the given maximum space and minimum bytes to be buffered ahead.
    pub fn new(max: usize, min: usize, reader: R) -> Self {
        BufReader {
            reader,
            buffer: DeqBuffer::new(max),
            min,
        }
    }

    /// Returns the total capacity of the inner buffer.
    pub fn capacity(&self) -> usize {
        self.buffer.capacity()
    }

    /// Returns the number of currently available bytes of the inner buffer.
    pub fn len(&self) -> usize {
        self.buffer.read_available()
    }

    /// Answers if the inner buffer is currently empty.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Returns the current slice to read from of the inner buffer.
    pub fn buffer(&self) -> &[u8] {
        self.buffer.read_slice()
    }
}

impl<R: Read> Read for BufReader<R> {
    fn read(&mut self, buffer: &mut [u8]) -> Result<usize> {
        if self.buffer.write_available() < self.min {
            self.buffer.flush();
        }

        let size = self.fill_buf()?.read(buffer)?;
        self.consume(size);
        Ok(size)
    }
}

impl<R: Read> BufRead for BufReader<R> {
    fn fill_buf(&mut self) -> Result<&[u8]> {
        if self.buffer.read_available() < self.min {
            self.buffer.flush();
        }

        if let Ok(size) = self.reader.read(self.buffer.write_slice()) {
            self.buffer.write_done(size);
        }

        Ok(self.buffer.read_slice())
    }

    fn consume(&mut self, size: usize) {
        self.buffer.read_done(size);
    }
}

impl<R: Seek> Seek for BufReader<R> {
    fn seek(&mut self, pos: SeekFrom) -> Result<u64> {
        let result: u64;

        if let SeekFrom::Current(pos) = pos {
            result = self
                .reader
                .seek(SeekFrom::Current(pos - self.len() as i64))?;
        } else {
            result = self.reader.seek(pos)?;
        }

        self.buffer.clear();
        Ok(result)
    }
}

/// A fixed buffer that could be used as a byte dequeue.
pub struct DeqBuffer {
    slice: Box<[u8]>,
    start: usize,
    end: usize,
}

impl DeqBuffer {
    /// Creates a new buffer with the given maximum space.
    ///
    /// # Safety
    ///
    /// The buffer needs to be written to before read from.
    pub fn new(size: usize) -> Self {
        let mut vec = Vec::with_capacity(size);
        let cap = vec.capacity();

        // SAFETY: Force the length of the vector to its capacity
        // instead of using 'resize' for performance reasons.
        unsafe {
            vec.set_len(cap);
        }

        DeqBuffer {
            slice: vec.into(),
            start: 0,
            end: 0,
        }
    }

    /// Returns the total capacity of the buffer.
    pub fn capacity(&self) -> usize {
        self.slice.len()
    }

    /// Clears the buffer by consuming all available bytes
    /// and returns the number of bytes being cleared.
    pub fn clear(&mut self) -> usize {
        let size = self.read_available();
        self.read_done(size)
    }

    /// Reads from this buffer into the given output
    /// and returns the number of bytes being read.
    pub fn read_to(&mut self, buffer: &mut [u8]) -> usize {
        let size = min(self.read_available(), buffer.len());
        buffer[..size].copy_from_slice(&self.read_slice()[..size]);
        self.read_done(size)
    }

    /// Returns the number of currently available bytes for reading.
    pub fn read_available(&self) -> usize {
        self.end - self.start
    }

    /// Returns the current slice to read from.
    pub fn read_slice(&self) -> &[u8] {
        &self.slice[self.start..self.end]
    }

    /// Signals the amount of newly read bytes from the buffer
    /// and returns the number of bytes being updated.
    pub fn read_done(&mut self, size: usize) -> usize {
        let before = self.start;

        self.start = min(self.start + size, self.slice.len());
        let diff = self.start - before;

        if self.start == self.end {
            self.start = 0;
            self.end = 0;
        }

        diff
    }

    /// Writes from the given input into this buffer
    /// and returns the number of bytes being written.
    pub fn write_from(&mut self, buffer: &[u8]) -> usize {
        let size = min(self.write_available(), buffer.len());
        self.write_slice()[..size].copy_from_slice(&buffer[..size]);
        self.write_done(size)
    }

    /// Returns the number of currently available bytes for writing.
    pub fn write_available(&self) -> usize {
        self.slice.len() - self.end
    }

    /// Returns the current slice to write to.
    pub fn write_slice(&mut self) -> &mut [u8] {
        &mut self.slice[self.end..]
    }

    /// Signals the amount of newly written bytes to the buffer
    /// and returns the number of bytes being updated.
    pub fn write_done(&mut self, size: usize) -> usize {
        let before = self.end;

        self.end = min(self.end + size, self.slice.len());
        self.end - before
    }

    /// Moves any remaining bytes within the buffer to its front
    /// and returns the number of bytes being moved.
    pub fn flush(&mut self) -> usize {
        let before = self.start;

        if self.start != 0 {
            // SAFETY: Copying the bytes is safe as pointers will not overlap.
            unsafe {
                copy(
                    self.read_slice().as_ptr(),
                    self.slice.as_mut_ptr(),
                    self.read_available(),
                );
            }

            self.end -= self.start;
            self.start = 0;
        }

        before
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_buffer() {
        let max_size = 1000;
        let chunk_size = 100;

        let chunk1: [u8; 100] = [1; 100];
        let chunk2: [u8; 100] = [2; 100];
        let chunk3: [u8; 100] = [3; 100];
        let mut temp: [u8; 100] = [0; 100];

        let mut buffer = DeqBuffer::new(max_size);
        assert_eq!(max_size, buffer.capacity());
        assert_eq!(max_size, buffer.write_available());
        assert_eq!(0, buffer.read_available());

        // write first chunk
        assert_eq!(chunk_size, buffer.write_from(&chunk1));
        assert_eq!(max_size - chunk_size, buffer.write_available());
        assert_eq!(chunk_size, buffer.read_available());

        // write second chunk
        assert_eq!(chunk_size, buffer.write_from(&chunk2));
        assert_eq!(max_size - chunk_size * 2, buffer.write_available());
        assert_eq!(chunk_size * 2, buffer.read_available());

        // read first chunk
        assert_eq!(chunk_size, buffer.read_to(&mut temp));
        assert_eq!(chunk1, temp);
        assert_eq!(max_size - chunk_size * 2, buffer.write_available());
        assert_eq!(chunk_size, buffer.read_available());

        // read second chunk will reset buffer
        assert_eq!(chunk_size, buffer.read_to(&mut temp));
        assert_eq!(chunk2, temp);
        assert_eq!(max_size, buffer.write_available());
        assert_eq!(0, buffer.read_available());

        // write first chunk
        assert_eq!(chunk_size, buffer.write_from(&chunk1));
        assert_eq!(max_size - chunk_size, buffer.write_available());
        assert_eq!(chunk_size, buffer.read_available());

        // write second chunk
        assert_eq!(chunk_size, buffer.write_from(&chunk2));
        assert_eq!(max_size - chunk_size * 2, buffer.write_available());
        assert_eq!(chunk_size * 2, buffer.read_available());

        // read first chunk
        assert_eq!(chunk_size, buffer.read_to(&mut temp));
        assert_eq!(chunk1, temp);
        assert_eq!(max_size - chunk_size * 2, buffer.write_available());
        assert_eq!(chunk_size, buffer.read_available());

        // write third chunk
        assert_eq!(chunk_size, buffer.write_from(&chunk3));
        assert_eq!(max_size - chunk_size * 3, buffer.write_available());
        assert_eq!(chunk_size * 2, buffer.read_available());

        // flush with rest
        assert_eq!(chunk_size, buffer.flush());
        assert_eq!(max_size - chunk_size * 2, buffer.write_available());
        assert_eq!(chunk_size * 2, buffer.read_available());

        // read second chunk
        assert_eq!(chunk_size, buffer.read_to(&mut temp));
        assert_eq!(chunk2, temp);
        assert_eq!(max_size - chunk_size * 2, buffer.write_available());
        assert_eq!(chunk_size, buffer.read_available());

        // clear buffer
        assert_eq!(chunk_size, buffer.clear());
        assert_eq!(max_size, buffer.write_available());
        assert_eq!(0, buffer.read_available());

        // write all
        for i in 0..max_size {
            buffer.write_slice()[i] = (i % 255) as u8;
        }
        assert_eq!(max_size, buffer.write_done(max_size));
        assert_eq!(0, buffer.write_available());
        assert_eq!(max_size, buffer.read_available());

        // buffer is full
        assert_eq!(0, buffer.write_done(1));

        // read one
        assert_eq!(1, buffer.read_done(1));
        assert_eq!(0, buffer.write_available());
        assert_eq!(max_size - 1, buffer.read_available());

        // flush rest
        assert_eq!(1, buffer.flush());
        assert_eq!(1, buffer.write_available());
        assert_eq!(max_size - 1, buffer.read_available());

        // read rest will reset buffer
        for i in 1..(max_size) {
            assert_eq!((i % 255) as u8, buffer.read_slice()[i - 1]);
        }
        assert_eq!(max_size - 1, buffer.read_done(max_size - 1));
        assert_eq!(max_size, buffer.write_available());
        assert_eq!(0, buffer.read_available());

        // buffer is empty
        assert_eq!(0, buffer.flush());
        assert_eq!(max_size, buffer.write_available());
        assert_eq!(0, buffer.read_available());
    }

    #[test]
    fn test_reader() {
        let input: &[u8] = &[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        let max_size = 5;
        let min_size = 2;

        let mut reader = BufReader::new(max_size, min_size, input);
        assert_eq!(max_size, reader.capacity());
        assert!(reader.is_empty());

        let mut output = [0, 0, 0];

        // read first chunk fills buffer
        assert_eq!(reader.read(&mut output).unwrap(), 3);
        assert_eq!(output, [1, 2, 3]);

        // read second chunk flushes buffer
        assert_eq!(reader.read(&mut output).unwrap(), 3);
        assert_eq!(output, [4, 5, 6]);

        // refill buffer if below minimum
        assert_eq!(reader.fill_buf().unwrap(), [7, 8]);
        reader.consume(1);
        assert_eq!(reader.fill_buf().unwrap(), [8, 9, 10, 11, 12]);

        // read third chunk from buffer
        assert_eq!(reader.read(&mut output).unwrap(), 3);
        assert_eq!(output, [8, 9, 10]);

        // drop some bytes and refill buffer
        reader.consume(1);
        assert_eq!(reader.read(&mut output).unwrap(), 3);
        assert_eq!(output, [12, 13, 14]);

        // read until end
        let mut rest = [0, 0, 0];
        assert_eq!(reader.read(&mut rest).unwrap(), 1);
        assert_eq!(rest, [15, 0, 0]);
        assert_eq!(reader.fill_buf().unwrap(), []);
    }

    #[test]
    fn test_seek() {
        let input: &[u8] = &[1, 2, 3, 4, 5, 6, 7, 8, 9];
        let mut reader = BufReader::new(2, 1, Cursor::new(input));

        // Seek from start
        assert_eq!(reader.seek(SeekFrom::Start(2)).unwrap(), 2);
        assert_eq!(reader.fill_buf().unwrap(), &[3, 4][..]);

        // Seek from current
        assert_eq!(reader.seek(SeekFrom::Current(1)).unwrap(), 3);
        assert_eq!(reader.fill_buf().unwrap(), &[4, 5][..]);

        // Seek empty
        assert_eq!(reader.seek(SeekFrom::Current(0)).unwrap(), 3);
        assert_eq!(reader.fill_buf().unwrap(), &[4, 5][..]);

        // Seek reverse
        assert_eq!(reader.seek(SeekFrom::Current(-1)).unwrap(), 2);
        assert_eq!(reader.fill_buf().unwrap(), &[3, 4][..]);

        // Seek after consuming bytes
        reader.consume(1);
        assert_eq!(reader.seek(SeekFrom::Current(1)).unwrap(), 4);
        assert_eq!(reader.fill_buf().unwrap(), &[5, 6][..]);

        // Seek to end
        assert_eq!(reader.seek(SeekFrom::Start(9)).unwrap(), 9);
        assert_eq!(reader.fill_buf().unwrap(), &[][..]);
    }
}

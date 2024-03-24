use buf_redux::{
    do_read,
    policy::{DoRead, ReaderPolicy},
    Buffer,
};
use tokio_util::sync::CancellationToken;

pub const REDUX_READER_CAPACITY: usize = 1024 * 1024;
pub const REDUX_MIN_BUFFER_SPACE: usize = 10 * 1024;

#[derive(Debug)]
pub struct CancallableMinBuffered(pub (usize, CancellationToken));

impl CancallableMinBuffered {
    /// Set the number of bytes to ensure are in the buffer.
    pub fn set_min(&mut self, min: usize) {
        self.0 .0 = min;
    }
}

impl ReaderPolicy for CancallableMinBuffered {
    fn before_read(&mut self, buffer: &mut Buffer) -> DoRead {
        // do nothing if we have enough data
        if buffer.len() >= self.0 .0 {
            do_read!(false)
        }

        let cap = buffer.capacity();

        // if there's enough room but some of it's stuck after the head
        if buffer.usable_space() < self.0 .0 && buffer.free_space() >= self.0 .0 {
            buffer.make_room();
        } else if cap < self.0 .0 {
            buffer.reserve(self.0 .0 - cap);
        }

        DoRead(true)
    }
}
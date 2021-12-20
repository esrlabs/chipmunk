use crate::ByteSource;
use crate::Error as SourceError;
use crate::ReloadInfo;
use crate::SourceFilter;
use buf_redux::Buffer;

pub struct UdpSource {
    buffer: Buffer,
}

impl ByteSource for UdpSource {
    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        todo!()
    }

    fn consume(&mut self, _offset: usize) {
        todo!()
    }

    fn len(&self) -> usize {
        todo!()
    }
}

use crate::ByteSource;
use crate::Error as SourceError;
use crate::ReloadInfo;
use crate::SourceFilter;
use async_trait::async_trait;
use buf_redux::Buffer;

pub struct UdpSource {
    buffer: Buffer,
}

#[async_trait]
impl ByteSource for UdpSource {
    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    async fn reload(
        &mut self,
        filter: Option<&SourceFilter>,
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

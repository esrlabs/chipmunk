use std::collections::VecDeque;

use async_trait::async_trait;

use crate::ByteSource;
use crate::Error;
use crate::ReloadInfo;
use crate::SourceFilter;

pub type MockSeedRes = Result<Option<MockReloadSeed>, Error>;

#[derive(Debug)]
pub struct MockByteSource {
    buffer: Vec<u8>,
    reload_seeds: VecDeque<MockSeedRes>,
}

impl MockByteSource {
    pub fn new(init_len: usize, reload_seeds: impl Into<VecDeque<MockSeedRes>>) -> Self {
        let buffer = vec![b'a'; init_len];
        Self {
            buffer,
            reload_seeds: reload_seeds.into(),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct MockReloadSeed {
    pub loaded: usize,
    pub skipped: usize,
    pub last_known_ts: Option<u64>,
}

impl MockReloadSeed {
    pub fn new(loaded: usize, skipped: usize, last_known_ts: Option<u64>) -> Self {
        Self {
            loaded,
            skipped,
            last_known_ts,
        }
    }
}

#[async_trait]
impl ByteSource for MockByteSource {
    fn consume(&mut self, offset: usize) {
        assert!(
            self.buffer.len() >= offset,
            "Offset can't be bigger than buffer length"
        );
        self.buffer.truncate(offset);
    }

    /// Provide access to the filtered data that is currently loaded
    fn current_slice(&self) -> &[u8] {
        &self.buffer
    }

    /// count of currently loaded bytes
    fn len(&self) -> usize {
        self.buffer.len()
    }

    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, Error> {
        let seed_res = self
            .reload_seeds
            .pop_front()
            .expect("Seeds count must match reload count");
        let seed_opt = seed_res?;

        let Some(seed) = seed_opt else {
            return Ok(None);
        };

        self.buffer
            .extend(std::iter::repeat(b'a').take(seed.loaded));

        let reload_info = ReloadInfo::new(
            seed.loaded,
            self.buffer.len(),
            seed.skipped,
            seed.last_known_ts,
        );

        Ok(Some(reload_info))
    }
}

#[tokio::test]
async fn test_mock_byte_source() {
    let seeds = [
        Ok(Some(MockReloadSeed::new(5, 0, None))),
        Ok(Some(MockReloadSeed::new(1, 2, Some(4)))),
        Ok(None),
        Err(Error::NotSupported),
    ];
    let mut source = MockByteSource::new(10, seeds);

    // Initial state
    assert_eq!(source.len(), 10);
    assert_eq!(source.current_slice(), &[b'a'; 10]);

    // Consume
    source.consume(5);
    assert_eq!(source.len(), 5);
    assert_eq!(source.current_slice(), &[b'a'; 5]);

    // Reload Calls
    let first_reload = source.reload(None).await;
    assert!(matches!(
        first_reload,
        Ok(Some(ReloadInfo {
            newly_loaded_bytes: 5,
            available_bytes: 10,
            skipped_bytes: 0,
            last_known_ts: None
        }))
    ));
    assert_eq!(source.len(), 10);
    assert_eq!(source.current_slice(), &[b'a'; 10]);

    let second_reload = source.reload(None).await;
    assert!(matches!(
        second_reload,
        Ok(Some(ReloadInfo {
            newly_loaded_bytes: 1,
            available_bytes: 11,
            skipped_bytes: 2,
            last_known_ts: Some(4)
        }))
    ));

    let third_reload = source.reload(None).await;
    assert!(matches!(third_reload, Ok(None)));

    let fourth_reload = source.reload(None).await;
    assert!(matches!(fourth_reload, Err(Error::NotSupported)));
}

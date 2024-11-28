use std::collections::VecDeque;
use std::time::Duration;

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
    pub sleep_duration: Option<Duration>,
}

impl MockReloadSeed {
    pub fn new(loaded: usize, skipped: usize) -> Self {
        Self {
            loaded,
            skipped,
            last_known_ts: None,
            sleep_duration: None,
        }
    }

    pub fn last_known_ts(mut self, val: u64) -> Self {
        self.last_known_ts = Some(val);
        self
    }

    pub fn sleep_duration(mut self, duration: Duration) -> Self {
        self.sleep_duration = Some(duration);
        self
    }
}

impl ByteSource for MockByteSource {
    fn consume(&mut self, offset: usize) {
        assert!(
            self.buffer.len() >= offset,
            "Offset can't be bigger than buffer length"
        );
        _ = self.buffer.drain(..offset);
    }

    /// Provide access to the filtered data that is currently loaded
    fn current_slice(&self) -> &[u8] {
        &self.buffer
    }

    /// count of currently loaded bytes
    fn len(&self) -> usize {
        self.buffer.len()
    }

    async fn load(&mut self, _filter: Option<&SourceFilter>) -> Result<Option<ReloadInfo>, Error> {
        let seed_res = self
            .reload_seeds
            .pop_front()
            .expect("Seeds count must match reload count");
        let seed_opt = seed_res?;

        let Some(seed) = seed_opt else {
            return Ok(None);
        };

        if let Some(duration) = seed.sleep_duration {
            tokio::time::sleep(duration).await;
        }

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

    async fn income(&mut self, msg: stypes::SdeRequest) -> Result<stypes::SdeResponse, Error> {
        // Read the input for now and return it's length
        let bytes = match &msg {
            stypes::SdeRequest::WriteText(text) => text.as_bytes(),
            stypes::SdeRequest::WriteBytes(bytes) => bytes,
        };
        Ok(stypes::SdeResponse { bytes: bytes.len() })
    }
}

#[tokio::test]
async fn general_test_mock_byte_source() {
    let seeds = [
        Ok(Some(MockReloadSeed::new(5, 0))),
        Ok(Some(MockReloadSeed::new(1, 2).last_known_ts(4))),
        Ok(None),
        Err(Error::NotSupported),
    ];
    let mut source = MockByteSource::new(10, seeds);

    // Initial state
    assert_eq!(source.len(), 10);
    assert_eq!(source.current_slice(), &[b'a'; 10]);

    // Consume
    source.consume(4);
    assert_eq!(source.len(), 6);
    assert_eq!(source.current_slice(), &[b'a'; 6]);

    // Reload Calls
    let first_reload = source.load(None).await;
    assert!(matches!(
        first_reload,
        Ok(Some(ReloadInfo {
            newly_loaded_bytes: 5,
            available_bytes: 11,
            skipped_bytes: 0,
            last_known_ts: None
        }))
    ));
    assert_eq!(source.len(), 11);
    assert_eq!(source.current_slice(), &[b'a'; 11]);

    let second_reload = source.load(None).await;
    assert!(matches!(
        second_reload,
        Ok(Some(ReloadInfo {
            newly_loaded_bytes: 1,
            available_bytes: 12,
            skipped_bytes: 2,
            last_known_ts: Some(4)
        }))
    ));

    let third_reload = source.load(None).await;
    assert!(matches!(third_reload, Ok(None)));

    let fourth_reload = source.load(None).await;
    assert!(matches!(fourth_reload, Err(Error::NotSupported)));
}

#[tokio::test]
async fn test_mock_byte_source_delay() {
    let delay = Duration::from_millis(5);
    let seeds = [Ok(Some(MockReloadSeed::new(5, 0).sleep_duration(delay)))];
    let mut source = MockByteSource::new(10, seeds);

    let instance = std::time::Instant::now();

    let res = source.load(None).await;

    let passed = instance.elapsed();

    // Method should succeed
    assert!(res.is_ok());

    // Reload should have taken more than the delayed time.
    assert!(passed > delay);
}

#[tokio::test]
async fn test_mock_byte_source_income() {
    let mut source = MockByteSource::new(10, []);

    // *** Bytes Tests ***

    const BYTES_LEN: usize = 5;

    let byte_msg = stypes::SdeRequest::WriteBytes(vec![b'a'; BYTES_LEN]);

    let byte_income_res = source.income(byte_msg).await;
    // Byte income should succeed producing a response with the length of the provided bytes.
    assert!(matches!(
        byte_income_res,
        Ok(stypes::SdeResponse { bytes: BYTES_LEN })
    ));

    // *** Text Tests ***
    const TEXT: &str = "income text";
    const TEXT_LEN: usize = TEXT.len();

    let text_msg = stypes::SdeRequest::WriteText(TEXT.into());

    let text_income_res = source.income(text_msg).await;

    // Text income should succeed producing a response wit the length of the provided text bytes.
    assert!(matches!(
        text_income_res,
        Ok(stypes::SdeResponse { bytes: TEXT_LEN })
    ));
}

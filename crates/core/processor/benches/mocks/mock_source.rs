use sources::ByteSource;
use std::hint::black_box;

#[derive(Debug, Clone)]
pub struct MockByteSource {}

impl MockByteSource {
    pub fn new() -> Self {
        Self {}
    }
}

// NOTE: Methods within trait implementation have inner non-async function that should never be
// inline and the trait method should be always inline. This remove unnecessary `Future::poll()`
// calls from the runtime to reduce its noise.

impl ByteSource for MockByteSource {
    #[inline(always)]
    fn consume(&mut self, offset: usize) {
        #[inline(never)]
        fn inner(offset: usize) {
            const ZERO: usize = 0;

            if offset == black_box(ZERO) {
                // Print message to avoid misleading compile time optimizations.
                println!("Consume is called with Zero offset");
            }
        }

        inner(offset);
    }

    #[inline(always)]
    fn current_slice(&self) -> &[u8] {
        #[inline(never)]
        fn inner(_phantom: &MockByteSource) -> &[u8] {
            black_box({
                const BYTES: [u8; 3] = [b'a', b's', b'a'];
                const REF: &[u8] = &BYTES;

                REF
            })
        }

        inner(self)
    }

    #[inline(always)]
    fn len(&self) -> usize {
        #[inline(never)]
        fn inner() -> usize {
            const LEN: usize = 3;

            black_box(LEN)
        }

        inner()
    }

    #[inline(always)]
    async fn load(
        &mut self,
        _filter: Option<&sources::SourceFilter>,
    ) -> Result<Option<sources::ReloadInfo>, sources::Error> {
        #[inline(never)]
        fn inner() -> Result<Option<sources::ReloadInfo>, sources::Error> {
            const AA: Result<Option<sources::ReloadInfo>, sources::Error> =
                Ok(Some(sources::ReloadInfo {
                    available_bytes: 5,
                    newly_loaded_bytes: 5,
                    skipped_bytes: 0,
                    last_known_ts: None,
                }));

            black_box(AA)
        }

        inner()
    }
}

pub mod mock_read;

pub use mock_read::{MockRead, MockRepeatRead};

use crate::ByteSource;

pub async fn general_source_reload_test<S: ByteSource>(byte_source: &mut S) {
    assert!(
        byte_source.is_empty(),
        "Source Reload Test must start with an empty source. Current Bytes count: {}",
        byte_source.current_slice().len()
    );

    let reload_1 = byte_source.reload(None).await.unwrap().unwrap();
    // At the start the newly loaded and the available bytes should match
    assert_eq!(reload_1.newly_loaded_bytes, reload_1.available_bytes);

    // Consume half of the available bytes
    let half_readen = reload_1.available_bytes / 2;
    byte_source.consume(half_readen);

    let reload_2 = byte_source.reload(None).await.unwrap().unwrap();

    let available_bytes_target =
        reload_2.newly_loaded_bytes + (reload_1.available_bytes - half_readen);

    assert_eq!(available_bytes_target, reload_2.available_bytes);

    // Length of loaded bytes and current slice must match when no filter is applied.
    assert_eq!(byte_source.len(), byte_source.current_slice().len());

    // available bytes must match the results of `len()` method.
    assert_eq!(available_bytes_target, byte_source.len());
}

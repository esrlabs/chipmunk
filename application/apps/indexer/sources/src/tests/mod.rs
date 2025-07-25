mod mock_read;

use crate::api::ByteSource;
pub use mock_read::*;

/// Do general tests on the reload returns to insure the [`byte_source`] match the trait signature
/// and documentations
pub async fn general_source_reload_test<S: ByteSource>(byte_source: &mut S) {
    assert!(
        byte_source.is_empty(),
        "Source Reload Test must start with an empty source. Current Bytes count: {}",
        byte_source.current_slice().len()
    );

    let load_1 = byte_source.load(None).await.unwrap().unwrap();
    // At the start the newly loaded and the available bytes should match
    assert_eq!(load_1.newly_loaded_bytes, load_1.available_bytes);

    // Consume half of the available bytes
    let half_read = load_1.available_bytes / 2;
    byte_source.consume(half_read);

    let load_2 = byte_source.load(None).await.unwrap().unwrap();

    let available_bytes_target = load_2.newly_loaded_bytes + (load_1.available_bytes - half_read);

    assert_eq!(available_bytes_target, load_2.available_bytes);

    // Length of loaded bytes and current slice must match when no filter is applied.
    assert_eq!(byte_source.len(), byte_source.current_slice().len());

    // available bytes must match the results of `len()` method.
    assert_eq!(available_bytes_target, byte_source.len());
}

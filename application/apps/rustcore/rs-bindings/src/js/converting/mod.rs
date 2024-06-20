// pub mod concat;
pub mod filter;
pub mod grabbing;
pub mod merge;
pub mod source;

/// Trait, which is used to convert given entity to bytes based on protobuf protocol
pub trait ToBytes {
    fn into_bytes(&mut self) -> Vec<u8>;
}

/// This function takes a vector of bytes (`u8`) and converts each byte to an `i32` value,
/// returning a new vector with the `i32` type. No data copying is performed; each `u8` value
/// is cast directly to an `i32`.
///
/// # Arguments
///
/// * `src` - A vector of bytes (`u8`) to be converted.
///
/// # Returns
///
/// A vector of integers (`i32`) containing the same values as the input vector.
///
/// # Reason
///
/// `node_bindgen` has support only `Vec<i32>` out of box. To have quick way to convert
/// `Vec<u8>` to `Vec<i32>` this function can be used.
pub fn u8_to_i32(src: Vec<u8>) -> Vec<i32> {
    src.into_iter().map(|b| b as i32).collect()
}

use std::{fmt::Display, str::FromStr};

/// The number of bytes in a Hash, 32.
pub const OUT_LEN: usize = blake3::OUT_LEN;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
/// Represents the calculated checksum value
/// Provides different methods to represents the hash value
pub struct HashDigest {
    hash: blake3::Hash,
}

impl Display for HashDigest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.hash)
    }
}

impl FromStr for HashDigest {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let hash = blake3::Hash::from_hex(s).map_err(|e| format!("Invalid Input. Error: {}", e))?;

        Ok(Self { hash })
    }
}

impl From<blake3::Hash> for HashDigest {
    fn from(hash: blake3::Hash) -> Self {
        Self { hash }
    }
}

impl From<[u8; OUT_LEN]> for HashDigest {
    fn from(bytes: [u8; OUT_LEN]) -> Self {
        blake3::Hash::from_bytes(bytes).into()
    }
}

impl From<HashDigest> for [u8; OUT_LEN] {
    fn from(hash: HashDigest) -> Self {
        hash.to_bytes()
    }
}

impl<'a> From<&'a HashDigest> for &'a [u8; OUT_LEN] {
    fn from(hash: &'a HashDigest) -> Self {
        hash.as_bytes()
    }
}

impl HashDigest {
    /// Returns a reference to the hash as bytes.
    pub fn as_bytes(&self) -> &[u8; OUT_LEN] {
        self.hash.as_bytes()
    }

    /// Convert the hash to bytes consuming itself.
    pub fn to_bytes(self) -> [u8; OUT_LEN] {
        self.hash.into()
    }
}

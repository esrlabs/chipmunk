use crate::*;

/// Converts a `Vec<Ident>` into an `AttachmentList`.
///
/// This implementation allows you to create an `IdentList` directly from a vector of
/// `Ident` objects. It simplifies the conversion and ensures compatibility
/// between these types.
impl From<Vec<Ident>> for IdentList {
    fn from(value: Vec<Ident>) -> Self {
        Self(value)
    }
}

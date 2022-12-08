use crate::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;

#[repr(u8)]
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Nature {
    Search = 0u8,
    Bookmark = 1u8,
    Selection = 2u8,
    Breadcrumb = 3u8,
    BreadcrumbSeporator = 4u8,
}

impl Nature {
    pub fn as_u8(&self) -> u8 {
        *self as u8
    }

    pub fn from(i: u8) -> Result<Self, NativeError> {
        match i {
            0 => Ok(Self::Search),
            1 => Ok(Self::Bookmark),
            2 => Ok(Self::Selection),
            3 => Ok(Self::Breadcrumb),
            4 => Ok(Self::BreadcrumbSeporator),
            _ => Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("Invalid index of Nature enum: {i}")),
            }),
        }
    }
}

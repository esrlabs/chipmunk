use std::ops::BitAnd;

use crate::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;

bitflags! {
    pub struct Nature: u8 {
        const SEARCH /*               */ = 0b00000001; // bit_pos = 0
        const BOOKMARK /*             */ = 0b00000010; // bit_pos = 1
        // Internal entity to quick find frame between pinned points
        const MARKER /*               */ = 0b00010000; // bit_pos = 4
        const EXPANDED /*             */ = 0b00100000; // bit_pos = 5
        const BREADCRUMB /*           */ = 0b01000000; // bit_pos = 6
        const BREADCRUMB_SEPORATOR /* */ = 0b10000000; // bit_pos = 7
        // Pinned points: SEARCH & BOOKMARKS
    }
}

impl Nature {
    pub fn new() -> Self {
        Nature { bits: 0b00000000 }
    }

    pub fn from(n: u8) -> Result<Self, NativeError> {
        let mut bits: u8 = 0b00000000;
        if Self::bit_at(n, 0) {
            bits |= 0b00000001;
        }
        if Self::bit_at(n, 1) {
            bits |= 0b00000010;
        }
        if Self::bit_at(n, 6) {
            bits |= 0b01000000;
        }
        if Self::bit_at(n, 7) {
            bits |= 0b10000000;
        }
        if !Self::bit_at(n, 0) && !Self::bit_at(n, 1) && !Self::bit_at(n, 6) && !Self::bit_at(n, 7)
        {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Invalid index of Nature u8: {}",
                    Self::as_string(n)
                )),
            });
        }
        Ok(Nature { bits })
    }

    fn as_string(n: u8) -> String {
        format!(
            "|{}|{}|{}|{}|{}|{}|{}|{}|",
            if Self::bit_at(n, 7) { 1 } else { 0 },
            if Self::bit_at(n, 6) { 1 } else { 0 },
            if Self::bit_at(n, 5) { 1 } else { 0 },
            if Self::bit_at(n, 4) { 1 } else { 0 },
            if Self::bit_at(n, 3) { 1 } else { 0 },
            if Self::bit_at(n, 2) { 1 } else { 0 },
            if Self::bit_at(n, 1) { 1 } else { 0 },
            if Self::bit_at(n, 0) { 1 } else { 0 }
        )
    }

    fn bit_at(n: u8, o: u8) -> bool {
        if o < 8 {
            n & (1 << o) != 0
        } else {
            false
        }
    }

    pub fn include(&mut self, nature: Nature) {
        self.set(nature, true);
    }

    pub fn exclude(&mut self, nature: Nature) {
        self.set(nature, false);
    }

    pub fn mark(&mut self) {
        self.set(Nature::MARKER, true);
    }

    pub fn unmark(&mut self) {
        self.set(Nature::MARKER, false);
    }

    pub fn replace_if_empty(&mut self, nature: Nature, replacement: Nature) -> bool {
        self.exclude(nature);
        if self.is_empty() {
            self.include(replacement);
            true
        } else {
            false
        }
    }

    pub fn set_if_cross(&mut self, filter: Nature, nature: Nature) {
        if self.cross(filter) {
            self.include(nature);
        }
    }

    pub fn reassign(&mut self, nature: Nature) {
        self.exclude(Nature::BREADCRUMB);
        self.exclude(Nature::BREADCRUMB_SEPORATOR);
        self.include(nature);
    }

    pub fn cross(&self, nature: Nature) -> bool {
        !self.bitand(nature).is_empty()
    }

    pub fn is_pinned(&self) -> bool {
        !self.is_breadcrumb() && !self.is_seporator()
    }

    pub fn is_marker(&self) -> bool {
        self.contains(Nature::MARKER)
    }

    pub fn is_search(&self) -> bool {
        self.contains(Nature::SEARCH)
    }

    pub fn is_bookmark(&self) -> bool {
        self.contains(Nature::BOOKMARK)
    }

    pub fn is_breadcrumb(&self) -> bool {
        self.contains(Nature::BREADCRUMB)
    }

    pub fn is_seporator(&self) -> bool {
        self.contains(Nature::BREADCRUMB_SEPORATOR)
    }

    pub fn is_expanded(&self) -> bool {
        self.contains(Nature::EXPANDED)
    }
}

impl Default for Nature {
    fn default() -> Self {
        Self::new()
    }
}

#[test]
fn test() {
    let mut n = Nature::new();
    assert!(!n.is_search());
    assert!(!n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(!n.is_seporator());
    n.include(Nature::SEARCH);
    assert!(n.is_search());
    assert!(!n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(!n.is_seporator());
    n.include(Nature::BOOKMARK);
    assert!(n.is_search());
    assert!(n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(!n.is_seporator());
    n.exclude(Nature::SEARCH);
    n.exclude(Nature::BOOKMARK);
    n.include(Nature::BREADCRUMB);
    assert!(!n.is_search());
    assert!(!n.is_bookmark());
    assert!(n.is_breadcrumb());
    assert!(!n.is_seporator());
    n.exclude(Nature::BREADCRUMB);
    n.include(Nature::BREADCRUMB_SEPORATOR);
    assert!(!n.is_search());
    assert!(!n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(n.is_seporator());
    let imported: u8 = n.bits();
    let b = Nature::from(imported).unwrap();
    assert!(!b.is_search());
    assert!(!b.is_bookmark());
    assert!(!b.is_breadcrumb());
    assert!(b.is_seporator());
    let n = Nature::SEARCH;
    assert!(n.is_search());
    assert!(!n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(!n.is_seporator());
    let n = Nature::BOOKMARK;
    assert!(!n.is_search());
    assert!(n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(!n.is_seporator());
    let n = Nature::BREADCRUMB;
    assert!(!n.is_search());
    assert!(!n.is_bookmark());
    assert!(n.is_breadcrumb());
    assert!(!n.is_seporator());
    let n = Nature::BREADCRUMB_SEPORATOR;
    assert!(!n.is_search());
    assert!(!n.is_bookmark());
    assert!(!n.is_breadcrumb());
    assert!(n.is_seporator());
    let left = Nature::SEARCH.union(Nature::BOOKMARK);
    let right = Nature::BOOKMARK.union(Nature::SEARCH);
    assert!(left == right);
    let left = Nature::SEARCH.union(Nature::BOOKMARK);
    let mut right = Nature::BOOKMARK
        .union(Nature::SEARCH)
        .union(Nature::BREADCRUMB);
    assert!(left != right);
    right.exclude(Nature::BREADCRUMB);
    assert!(left == right);
    let left = Nature::SEARCH.union(Nature::BOOKMARK);
    let right = Nature::BOOKMARK
        .union(Nature::SEARCH)
        .union(Nature::BREADCRUMB);
    assert!(right.contains(left));
    assert!(!left.contains(right));
    assert!(right.cross(left));
    let left = Nature::BOOKMARK
        .union(Nature::SEARCH)
        .union(Nature::BREADCRUMB);
    assert!(left.cross(Nature::SEARCH));
    assert!(left.cross(Nature::BOOKMARK));
    assert!(left.cross(Nature::BREADCRUMB));
    assert!(!left.cross(Nature::BREADCRUMB_SEPORATOR));
    assert!(!left.cross(Nature::MARKER));
    assert!(left.cross(
        Nature::BREADCRUMB
            .union(Nature::BREADCRUMB_SEPORATOR)
            .union(Nature::MARKER)
    ));
    assert!(!left.cross(Nature::BREADCRUMB_SEPORATOR.union(Nature::MARKER)));
}

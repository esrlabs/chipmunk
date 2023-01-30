use crate::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;

#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub struct Nature(u8);
impl Nature {
    pub const SEARCH: Nature = Nature(1);
    pub const BOOKMARK: Nature = Nature(1 << 2);
    // Internal entity to quick find frame between pinned points
    pub const MARKER: Nature = Nature(1 << 4);
    pub const EXPANDED: Nature = Nature(1 << 5);
    pub const BREADCRUMB: Nature = Nature(1 << 6);
    pub const BREADCRUMB_SEPORATOR: Nature = Nature(1 << 7);

    pub(crate) fn union(&self, other: Nature) -> Nature {
        Nature(self.0 | other.0)
    }
}

impl TryFrom<u8> for Nature {
    type Error = NativeError;
    fn try_from(n: u8) -> Result<Self, Self::Error> {
        if 0b00111100 & n > 0 {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Invalid index of Nature u8: {}",
                    Self::as_string(n)
                )),
            });
        }
        Ok(Nature(n))
    }
}
// impl From<NatureKind> for Nature {
//     fn from(n: NatureKind) -> Self {
//         Nature(n as u8)
//     }
// }
impl Nature {
    pub fn new() -> Self {
        Nature(0)
    }

    pub fn bits(&self) -> u8 {
        self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0 == 0
    }

    fn as_string(n: u8) -> String {
        format!("{n:08b}")
    }

    pub fn contains(&self, nature: &Nature) -> bool {
        let mut res = true;
        for i in 0..=7 {
            let mask = 1 << i;
            res &= self.0 & mask >= nature.0 & mask;
        }
        res
    }

    pub fn include(&mut self, nature: Nature) {
        self.0 |= nature.0;
    }

    pub fn exclude(&mut self, nature: Nature) {
        self.0 &= !nature.0;
    }

    pub fn mark(&mut self) {
        self.0 |= Nature::MARKER.0;
    }

    pub fn unmark(&mut self) {
        self.0 &= Nature::MARKER.0;
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
        (self.0 & nature.0) != 0
    }

    pub fn is_pinned(&self) -> bool {
        !self.is_breadcrumb() && !self.is_seporator()
    }

    pub fn is_marker(&self) -> bool {
        self.contains(&Nature::MARKER)
    }

    pub fn is_search(&self) -> bool {
        self.contains(&Nature::SEARCH)
    }

    pub fn is_bookmark(&self) -> bool {
        self.contains(&Nature::BOOKMARK)
    }

    pub fn is_breadcrumb(&self) -> bool {
        self.contains(&Nature::BREADCRUMB)
    }

    pub fn is_seporator(&self) -> bool {
        self.contains(&Nature::BREADCRUMB_SEPORATOR)
    }

    pub fn is_expanded(&self) -> bool {
        self.contains(&Nature::EXPANDED)
    }
}

impl Default for Nature {
    fn default() -> Self {
        Self::new()
    }
}

#[test]
fn test_nature() {
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
    let b = Nature::try_from(imported).unwrap();
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
    assert!(right.contains(&left));
    assert!(!left.contains(&right));
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

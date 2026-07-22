//! Module for the definitions of the nature (kind) of the searches.

/// Represents the nature (kind) of the search.
#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub struct Nature(u8);

impl Nature {
    pub const SEARCH: Nature = Nature(1);
    pub const BOOKMARK: Nature = Nature(1 << 1);

    pub fn new() -> Self {
        Nature(0)
    }

    pub fn bits(&self) -> u8 {
        self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0 == 0
    }

    pub fn contains(&self, nature: &Nature) -> bool {
        let mut contains = true;
        for bit in 0..=7 {
            let mask = 1 << bit;
            contains &= self.0 & mask >= nature.0 & mask;
        }
        contains
    }

    pub fn include(&mut self, nature: Nature) {
        self.0 |= nature.0;
    }

    pub fn exclude(&mut self, nature: Nature) {
        self.0 &= !nature.0;
    }

    pub fn is_search(&self) -> bool {
        self.contains(&Nature::SEARCH)
    }

    pub fn is_bookmark(&self) -> bool {
        self.contains(&Nature::BOOKMARK)
    }
}

impl Default for Nature {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::Nature;

    #[test]
    fn search_and_bookmark_membership_can_overlap() {
        let mut nature = Nature::SEARCH;
        nature.include(Nature::BOOKMARK);

        assert!(nature.is_search());
        assert!(nature.is_bookmark());

        nature.exclude(Nature::SEARCH);
        assert!(!nature.is_search());
        assert!(nature.is_bookmark());

        nature.exclude(Nature::BOOKMARK);
        assert!(nature.is_empty());
    }

    #[test]
    fn bits_serialize_search_and_bookmark_membership() {
        assert_eq!(Nature::new().bits(), 0);
        assert_eq!(Nature::SEARCH.bits(), 1);
        assert_eq!(Nature::BOOKMARK.bits(), 1 << 1);

        let mut overlap = Nature::SEARCH;
        overlap.include(Nature::BOOKMARK);
        assert_eq!(
            overlap.bits(),
            Nature::SEARCH.bits() | Nature::BOOKMARK.bits()
        );
    }
}

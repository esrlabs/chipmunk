use crate::target::Target;
use std::collections::HashSet;

pub trait RemoveDuplicates {
    fn remove_duplicates(&mut self);
}

impl RemoveDuplicates for Vec<Target> {
    fn remove_duplicates(&mut self) {
        let mut seen = HashSet::new();
        self.retain(|c| {
            let is_first = !seen.contains(c);
            seen.insert(c.clone());
            is_first
        });
    }
}

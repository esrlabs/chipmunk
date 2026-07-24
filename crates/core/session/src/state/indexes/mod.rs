pub mod controller;
pub mod frame;
pub mod keys;
pub mod map;
pub mod nature;

/// Direction for navigation through an ordered row sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexedNavigation {
    /// Navigate toward lower indexes, wrapping to the end when supported.
    Previous,
    /// Navigate toward higher indexes, wrapping to the beginning when supported.
    Next,
}

#[cfg(test)]
pub mod tests_controller;
#[cfg(test)]
pub mod tests_map_cases;

pub mod controller;
pub mod frame;
pub mod keys;
pub mod map;
pub mod nature;

/// Direction for selecting a neighboring row from the indexed row map.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexedNavigation {
    /// Select the nearest indexed row lower than the anchor, wrapping to the last row.
    Previous,
    /// Select the nearest indexed row higher than the anchor, wrapping to the first row.
    Next,
}

#[cfg(test)]
pub mod tests_controller;
#[cfg(test)]
pub mod tests_map_cases;
#[cfg(test)]
pub mod tests_map_performance;

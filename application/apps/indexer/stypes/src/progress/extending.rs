use crate::*;

impl Ticks {
    /// Checks if the operation associated with the `Ticks` instance is complete.
    ///
    /// # Returns
    /// - `true` if the `count` equals `total` and `total` is not `None`.
    /// - `false` otherwise.
    ///
    /// # Details
    /// - If `total` is `None`, the operation is considered incomplete.
    pub fn done(&self) -> bool {
        self.total.is_some_and(|total| self.count == total)
    }
}

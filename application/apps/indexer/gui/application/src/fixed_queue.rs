//! Definitions and implementation for a queue with fixed capacity.

use std::collections::VecDeque;

#[derive(Debug, Clone, PartialEq)]
pub struct FixedQueue<T> {
    queue: VecDeque<T>,
    max_size: usize,
}

impl<T> FixedQueue<T> {
    /// Creates a new instance of the queue with the provided max size.
    pub fn new(max_size: usize) -> Self {
        let queue = VecDeque::with_capacity(max_size);
        Self { queue, max_size }
    }

    /// Add items to the queue removing the oldest item if queue becomes larger
    /// than the size limit
    pub fn add_item(&mut self, item: T) {
        self.queue.push_back(item);
        self.truncate_to_limit();
    }

    /// Remove the oldest items from the queue until it fits max size limit.
    fn truncate_to_limit(&mut self) {
        while self.queue.len() > self.max_size {
            self.queue.pop_front();
        }
    }

    /// Sets the max size of the queue.
    /// This will remove the oldest items from the queue until it fits
    /// the new size.
    pub fn set_max_size(&mut self, max_size: usize) {
        self.max_size = max_size;
        self.truncate_to_limit();
    }

    /// Returns all the items in the queue in the order (most recent to oldest)
    pub fn all_items(&self) -> impl Iterator<Item = &T> {
        self.queue.iter().rev()
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.queue.len()
    }

    #[inline]
    pub fn clear(&mut self) {
        self.queue.clear();
    }
}

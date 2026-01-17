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
    #[allow(unused)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new() {
        let queue: FixedQueue<i32> = FixedQueue::new(3);
        assert_eq!(queue.len(), 0);
        assert!(queue.is_empty());
    }

    #[test]
    fn test_add_item() {
        let mut queue = FixedQueue::new(3);
        queue.add_item(1);
        queue.add_item(2);
        queue.add_item(3);
        assert_eq!(queue.len(), 3);
        assert_eq!(queue.all_items().collect::<Vec<_>>(), vec![&3, &2, &1]);

        // Add 4th item, 1 should be dropped
        queue.add_item(4);
        assert_eq!(queue.len(), 3);
        assert_eq!(queue.all_items().collect::<Vec<_>>(), vec![&4, &3, &2]);
    }

    #[test]
    fn test_set_max_size_shrink() {
        let mut queue = FixedQueue::new(5);
        for i in 1..=5 {
            queue.add_item(i);
        }
        assert_eq!(queue.len(), 5);

        // Shrink to 3, oldest (1, 2) should be dropped
        queue.set_max_size(3);
        assert_eq!(queue.len(), 3);
        assert_eq!(queue.all_items().collect::<Vec<_>>(), vec![&5, &4, &3]);
    }

    #[test]
    fn test_set_max_size_grow() {
        let mut queue = FixedQueue::new(2);
        queue.add_item(1);
        queue.add_item(2);

        queue.set_max_size(5);
        assert_eq!(queue.len(), 2);
        queue.add_item(3);
        assert_eq!(queue.len(), 3);
        assert_eq!(queue.all_items().collect::<Vec<_>>(), vec![&3, &2, &1]);
    }

    #[test]
    fn test_clear() {
        let mut queue = FixedQueue::new(3);
        queue.add_item(1);
        queue.add_item(2);
        queue.clear();
        assert_eq!(queue.len(), 0);
        assert!(queue.is_empty());
    }
}

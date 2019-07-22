use std::cmp::Ordering;

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct TimedLine {
    pub timestamp: i64,
    pub content: String,
    pub tag: String,
    pub original_length: usize,
    pub year_was_missing: bool,
}

impl Ord for TimedLine {
    fn cmp(&self, other: &TimedLine) -> Ordering {
        self.timestamp.cmp(&other.timestamp)
    }
}
impl PartialOrd for TimedLine {
    fn partial_cmp(&self, other: &TimedLine) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

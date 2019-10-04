#[derive(Debug)]
pub enum IndexingProgress<T> {
    GotItem { item: T },
    Progress { ticks: (usize, usize) },
    Stopped,
    Finished,
}

pub enum IndexingResult<T> {
    Completed(T),
    Interrupted(T),
}

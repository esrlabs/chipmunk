use stypes::GrabbedElement;

#[derive(Debug, Default)]
pub struct SessionState {
    pub main_table: MainTable,
    pub logs_count: u64,
}

#[derive(Debug, Default)]
pub struct MainTable {
    /// The index of first line in logs window
    pub idx_offset: u64,
    pub logs_window: Vec<String>,
}

impl MainTable {
    pub fn append(&mut self, items: Vec<GrabbedElement>) {
        self.logs_window
            .extend(items.into_iter().map(|e| e.content));
    }
}

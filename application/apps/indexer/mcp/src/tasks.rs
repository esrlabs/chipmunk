use crate::parameters::{ChartFilter, SearchFilter};

#[derive(Debug)]
pub enum Task {
    ApplyFilter { filters: Vec<SearchFilter> },
    ApplyChart { filter: Vec<ChartFilter> },
}

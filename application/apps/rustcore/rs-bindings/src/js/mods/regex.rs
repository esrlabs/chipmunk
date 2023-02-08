use crate::js::converting::filter::WrappedSearchFilter;
use node_bindgen::derive::node_bindgen;
use processor::search::filter::get_filter_error as validator;

#[node_bindgen]
fn get_filter_error(filter: WrappedSearchFilter) -> Option<String> {
    validator(&filter.as_filter())
}

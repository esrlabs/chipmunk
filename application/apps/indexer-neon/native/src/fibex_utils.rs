use dlt::fibex::FibexMetadata;
use indexer_base::config::FibexConfig;
use std::path;
use std::rc::Rc;

pub(crate) fn gather_fibex_data(fibex: FibexConfig) -> Option<Rc<FibexMetadata>> {
    if fibex.fibex_file_paths.is_empty() {
        None
    } else {
        let paths: Vec<path::PathBuf> = fibex
            .fibex_file_paths
            .into_iter()
            .map(path::PathBuf::from)
            .collect();
        match dlt::fibex::read_fibexes(paths) {
            Ok(res) => Some(std::rc::Rc::new(res)),
            Err(e) => {
                warn!("error reading fibex {}", e);
                None
            }
        }
    }
}

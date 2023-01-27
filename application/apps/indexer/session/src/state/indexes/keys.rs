use crate::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;

#[derive(Debug)]
pub struct Keys {
    keys: Vec<u64>,
}

impl Keys {
    pub fn new() -> Self {
        Keys { keys: vec![] }
    }
    pub fn add(&mut self, position: u64) {
        self.keys.push(position);
    }

    pub fn remove(&mut self, position: &u64) {
        if let Ok(index) = self.keys.binary_search(position) {
            self.keys.remove(index);
        }
        // self.keys
        //     .remove(self.keys.binary_search(position).map_err(|_| NativeError {
        //         severity: Severity::ERROR,
        //         kind: NativeErrorKind::Grabber,
        //         message: Some(String::from(
        //             "Cannot insert breadcrumbs because indexes are empty",
        //         )),
        //     })?);
        // Ok(())
    }

    pub fn clear(&mut self) {
        self.keys.clear();
    }

    pub fn sort(&mut self) {
        self.keys.sort();
    }

    pub fn get_index(&mut self, position: &u64) -> Result<usize, NativeError> {
        self.sort();
        self.keys.binary_search(position).map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from(
                "Cannot insert breadcrumbs because indexes are empty",
            )),
        })
    }

    pub fn get_position(&self, index: usize) -> Result<u64, NativeError> {
        self.keys.get(index).map(|p| *p).ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from(
                "Cannot insert breadcrumbs because indexes are empty",
            )),
        })
    }
}

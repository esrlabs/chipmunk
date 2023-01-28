use crate::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;

#[derive(Debug)]
pub struct Keys {
    keys: Vec<u64>,
    sorted: bool,
}

impl Keys {
    pub fn new() -> Self {
        Keys {
            keys: vec![],
            sorted: false,
        }
    }
    pub fn add(&mut self, position: u64) {
        self.keys.push(position);
        self.sorted = false;
    }

    pub fn remove(&mut self, position: &u64) {
        if let Ok(index) = self.keys.binary_search(position) {
            self.keys.remove(index);
        }
    }

    pub fn clear(&mut self) {
        self.keys.clear();
    }

    pub fn sort(&mut self) {
        if !self.sorted {
            self.keys.sort();
            self.sorted = true;
        }
    }

    pub fn get_index(&mut self, position: &u64) -> Result<usize, NativeError> {
        self.sort();
        self.keys.binary_search(position).map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!("Cannot index for position: {position}")),
        })
    }

    pub fn get_position(&self, index: usize) -> Result<u64, NativeError> {
        self.keys.get(index).copied().ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!("Cannot find position for index: {index}")),
        })
    }

    pub fn first(&mut self) -> Option<&u64> {
        self.sort();
        self.keys.first()
    }

    pub fn last(&mut self) -> Option<&u64> {
        self.sort();
        self.keys.last()
    }

    pub fn clone(&mut self) -> Vec<u64> {
        self.sort();
        self.keys.clone()
    }
}

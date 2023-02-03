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
        self.sort();
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

    pub fn get_positions_around(
        &mut self,
        position: &u64,
    ) -> Result<(Option<u64>, Option<u64>), NativeError> {
        let mut before: Option<u64> = None;
        let mut after: Option<u64> = None;
        self.sort();
        let key = self.keys.binary_search(position).map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!("Cannot index for position: {position}")),
        })?;
        if key > 0 {
            before = Some(self.keys[key - 1]);
        }
        if (key + 1) < self.keys.len() {
            after = Some(self.keys[key + 1]);
        }
        Ok((before, after))
    }

    pub fn first(&mut self) -> Option<&u64> {
        self.sort();
        self.keys.first()
    }

    pub fn last(&mut self) -> Option<&u64> {
        self.sort();
        self.keys.last()
    }

    pub fn get(&mut self) -> Vec<u64> {
        self.sort();
        self.keys.clone()
    }
}

mod test {
    #[test]
    fn test_keys_001() {
        let mut keys = super::Keys::new();
        assert_eq!(keys.first(), None);
        keys.add(13);
        keys.add(100);
        keys.add(12);
        keys.add(11);
        keys.add(200);
        keys.add(1);
        keys.sort();
        keys.remove(&100);
        assert_eq!(keys.get(), vec![1, 11, 12, 13, 200]);
    }

    #[test]
    fn test_keys_002() {
        let mut keys = super::Keys::new();
        assert_eq!(keys.first(), None);
        keys.add(13);
        keys.add(100);
        keys.add(12);
        keys.add(11);
        keys.add(200);
        keys.add(1);
        keys.sort();
        keys.remove(&100);
        keys.remove(&11);
        keys.remove(&1);
        assert_eq!(
            vec![
                keys.get_index(&12).unwrap(),
                keys.get_index(&13).unwrap(),
                keys.get_index(&200).unwrap()
            ],
            vec![0, 1, 2,]
        );
    }
}

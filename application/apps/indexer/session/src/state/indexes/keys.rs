use std::ops::RangeInclusive;

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

    pub fn as_ranges(&self) -> Vec<RangeInclusive<u64>> {
        let mut ranges = vec![];
        let mut from: u64 = 0;
        let mut to: u64 = 0;
        for (i, value) in self.keys.iter().enumerate() {
            if i == 0 {
                from = *value;
            } else if to + 1 != *value {
                ranges.push(RangeInclusive::new(from, to));
                from = *value;
            }
            to = *value;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from)
            || (ranges.is_empty() && !self.keys.is_empty())
        {
            ranges.push(RangeInclusive::new(from, to));
        }
        ranges
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

    pub fn remove_ranges(&mut self, ranges: &[RangeInclusive<u64>]) -> Result<(), String> {
        self.sort();
        for range in ranges.iter() {
            if let (Ok(start), Ok(end)) = (
                self.keys.binary_search(range.start()),
                self.keys.binary_search(range.end()),
            ) {
                self.keys.drain(start..=end);
            } else {
                return Err(format!("Fail to find indexes for range: {range:?}"));
            }
        }
        Ok(())
    }

    pub fn remove_from(&mut self, position_from: &u64) -> Result<Vec<u64>, stypes::NativeError> {
        self.sort();
        let from_index =
            self.keys
                .binary_search(position_from)
                .map_err(|_| stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Grabber,
                    message: Some(format!("Cannot find index for position: {position_from}")),
                })?;
        if from_index + 1 < self.keys.len() {
            Ok(self.keys.drain((from_index + 1)..self.keys.len()).collect())
        } else {
            Ok(vec![])
        }
    }

    pub fn clear(&mut self) -> &mut Self {
        self.keys.clear();
        self
    }

    pub fn sort(&mut self) {
        if !self.sorted {
            self.keys.sort();
            self.sorted = true;
        }
    }

    pub fn import(&mut self, indexes: Vec<u64>) {
        self.keys = indexes;
        self.sorted = false;
    }

    pub fn get_index(&mut self, position: &u64) -> Result<usize, stypes::NativeError> {
        self.sort();
        self.keys
            .binary_search(position)
            .map_err(|_| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("Cannot find index for position: {position}")),
            })
    }

    pub fn get_position(&self, index: usize) -> Result<u64, stypes::NativeError> {
        self.keys.get(index).copied().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(format!("Cannot find position for index: {index}")),
        })
    }

    pub fn get_positions_around(
        &mut self,
        position: &u64,
    ) -> Result<(Option<u64>, Option<u64>), stypes::NativeError> {
        let mut before: Option<u64> = None;
        let mut after: Option<u64> = None;
        self.sort();
        let key = self
            .keys
            .binary_search(position)
            .map_err(|_| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
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

    #[test]
    fn test_keys_003() {
        use std::ops::RangeInclusive;
        let mut keys = super::Keys::new();
        assert_eq!(keys.first(), None);
        keys.add(100);
        keys.add(101);
        keys.add(102);
        keys.add(103);
        keys.add(104);
        keys.add(105);
        keys.add(11);
        keys.add(12);
        keys.add(13);
        keys.add(14);
        keys.add(15);
        keys.add(7);
        keys.sort();
        assert_eq!(
            keys.remove_ranges(&[RangeInclusive::new(11, 15), RangeInclusive::new(100, 105)]),
            Ok(())
        );
        assert_eq!(keys.keys.len(), 1);
        assert_eq!(keys.first(), Some(&7));
        keys.remove(&7);
        assert_eq!(keys.first(), None);
    }

    #[test]
    fn test_keys_004() {
        use std::ops::RangeInclusive;
        let mut keys = super::Keys::new();
        assert_eq!(keys.first(), None);
        keys.add(100);
        keys.add(101);
        keys.add(102);
        keys.add(103);
        keys.add(104);
        keys.add(105);
        keys.add(13);
        keys.add(12);
        keys.add(11);
        keys.add(10);
        keys.add(5);
        keys.add(4);
        keys.add(3);
        keys.add(2);
        keys.add(1);
        keys.sort();
        let ranges = keys.as_ranges();
        assert_eq!(ranges.len(), 3);
        assert_eq!(ranges[0], RangeInclusive::new(1, 5));
        assert_eq!(ranges[1], RangeInclusive::new(10, 13));
        assert_eq!(ranges[2], RangeInclusive::new(100, 105));
    }
}

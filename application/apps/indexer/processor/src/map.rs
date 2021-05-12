use std::{cmp::Ordering, collections::HashMap};

#[derive(Eq)]
struct FilterMatch(u8, u16);

impl PartialOrd for FilterMatch {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for FilterMatch {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.cmp(&other.0)
    }
}

impl PartialEq for FilterMatch {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

/// Holds search results map
/// Full dataset is:
///     Vec<
///         (
///             position in stream: u64,
///             array of filter's indexes matched with row: Vec<u8>
///         )
///     >
///
#[derive(Default)]
pub struct SearchMap {
    matches: Vec<(u64, Vec<u8>)>,
    stream_len: u64,
}

impl SearchMap {
    pub fn new() -> Self {
        Self {
            matches: vec![],
            stream_len: 0,
        }
    }

    /// Returns scaled search results map. As soon as we are limited with screen/frame size (dataset_len).
    pub fn get(&self, dataset_len: u16, range: Option<(u64, u64)>) -> Vec<Vec<(u8, u16)>> {
        let mut map: Vec<Vec<(u8, u16)>> = vec![];
        if let Some((from, to)) = range {
            let range_len = to - from;
            let rate: f64 = (range_len as f64) / (dataset_len as f64);
            let mut cursor: usize = 0;
            if rate <= 1.0 {
                loop {
                    if self.matches[cursor].0 >= from {
                        break;
                    } else {
                        cursor += 1;
                    }
                }
                for n in 0..=range_len {
                    if cursor < self.matches.len() {
                        if self.matches[cursor].0 == from + n {
                            map.push(
                                self.matches[cursor]
                                    .1
                                    .iter()
                                    .map(|filter| (*filter, 1))
                                    .collect(),
                            );
                            cursor += 1;
                        } else {
                            map.push(vec![]);
                        }
                    } else {
                        map.push(vec![]);
                    }
                }
            } else {
                for n in 1..=dataset_len {
                    if cursor < self.matches.len() {
                        let last_pos_in_results: u64 =
                            (rate * (n as f64) + from as f64).floor() as u64;
                        let first_pos_in_results: u64 =
                            (rate * ((n - 1) as f64) + from as f64).floor() as u64;
                        let mut segment: HashMap<u8, u16> = HashMap::new();
                        loop {
                            if cursor >= self.matches.len()
                                || self.matches[cursor].0 > last_pos_in_results
                            {
                                break;
                            }
                            if self.matches[cursor].0 < first_pos_in_results {
                                cursor += 1;
                                continue;
                            }
                            for filter_ref in &self.matches[cursor].1 {
                                *segment.entry(*filter_ref).or_insert(0) += 1;
                            }
                            cursor += 1;
                        }
                        let mut filter_matches: Vec<FilterMatch> = segment
                            .into_iter()
                            .map(|(pos, meets)| FilterMatch(pos, meets))
                            .collect();
                        filter_matches.sort();
                        map.push(filter_matches.into_iter().map(|i| (i.0, i.1)).collect());
                    } else {
                        map.push(vec![]);
                        cursor += 1;
                    }
                }
            }
        } else {
            let rate: f64 = (self.stream_len as f64) / (dataset_len as f64);
            let mut cursor: usize = 0;
            if rate <= 1.0 {
                for n in 1..=self.stream_len {
                    if cursor < self.matches.len() {
                        if (self.matches[cursor]).0 == n {
                            map.push(
                                self.matches[cursor]
                                    .1
                                    .iter()
                                    .map(|filter| (*filter, 1))
                                    .collect(),
                            );
                            cursor += 1;
                        } else {
                            map.push(vec![]);
                        }
                    } else {
                        map.push(vec![]);
                    }
                }
            } else {
                for n in 1..=dataset_len {
                    if cursor < self.matches.len() {
                        let last_pos_in_segment: u64 = (rate * (n as f64)).floor() as u64;
                        let mut segment: HashMap<u8, u16> = HashMap::new();
                        loop {
                            if cursor >= self.matches.len()
                                || self.matches[cursor].0 > last_pos_in_segment
                            {
                                break;
                            }
                            for filter_ref in &self.matches[cursor].1 {
                                *segment.entry(*filter_ref).or_insert(0) += 1;
                            }
                            cursor += 1;
                        }
                        let mut filter_matches: Vec<FilterMatch> = segment
                            .into_iter()
                            .map(|(pos, meets)| FilterMatch(pos, meets))
                            .collect();
                        filter_matches.sort();
                        map.push(filter_matches.into_iter().map(|i| (i.0, i.1)).collect());
                    } else {
                        map.push(vec![]);
                        cursor += 1;
                    }
                }
            }
        }
        map
    }

    pub fn set(&mut self, matches: Option<Vec<(u64, Vec<u8>)>>) {
        if let Some(matches) = matches {
            self.matches = matches;
        } else {
            self.matches = vec![];
        }
    }

    pub fn set_stream_len(&mut self, len: u64) {
        self.stream_len = len;
    }

    pub fn append(&mut self, matches: &mut Vec<(u64, Vec<u8>)>) {
        self.matches.append(matches);
    }
}

#[test]
fn test() {
    let mut map: SearchMap = SearchMap::new();
    map.set(Some(vec![
        (10, vec![0]),
        (20, vec![1]),
        (30, vec![0]),
        (40, vec![1]),
        (50, vec![0]),
        (60, vec![1]),
        (70, vec![0]),
        (80, vec![1]),
        (90, vec![0]),
        (100, vec![1]),
        (110, vec![0]),
        (120, vec![1]),
        (130, vec![0]),
        (140, vec![1]),
        (150, vec![0]),
        (160, vec![1]),
        (170, vec![0]),
        (180, vec![1]),
        (190, vec![0]),
        (200, vec![1]),
    ]));

    map.set_stream_len(200);
    let scaled = map.get(10, None);
    assert_eq!(scaled.len(), 10);
    for matches in scaled.iter() {
        assert_eq!(matches.len(), 2);
        if (matches[0] != (0, 1) && matches[1] != (1, 1))
            && (matches[0] != (1, 1) && matches[1] != (0, 1))
        {
            assert_eq!(true, false);
        }
    }

    map.set_stream_len(200);
    let scaled = map.get(5, None);
    assert_eq!(scaled.len(), 5);
    for matches in scaled.iter() {
        assert_eq!(matches.len(), 2);
        if (matches[0] != (0, 2) && matches[1] != (1, 2))
            && (matches[0] != (1, 2) && matches[1] != (0, 2))
        {
            assert_eq!(true, false);
        }
    }

    map.set_stream_len(1000);
    let scaled = map.get(10, None);
    assert_eq!(scaled.len(), 10);
    for n in 0..10 {
        if n < 2 {
            assert_eq!(scaled[n][0], (0, 5));
            assert_eq!(scaled[n][1], (1, 5));
        } else {
            assert_eq!(scaled[n].is_empty(), true);
        }
    }

    map.set_stream_len(200);
    let scaled = map.get(200, None);
    assert_eq!(scaled.len(), 200);
    for n in (1..=20).step_by(2) {
        assert_eq!(scaled[n * 10 - 1][0], (0, 1));
        assert_eq!(scaled[(n + 1) * 10 - 1][0], (1, 1));
    }

    map.set_stream_len(200);
    let scaled = map.get(1000, None);
    assert_eq!(scaled.len(), 200);
    for n in (1..=20).step_by(2) {
        assert_eq!(scaled[n * 10 - 1][0], (0, 1));
        assert_eq!(scaled[(n + 1) * 10 - 1][0], (1, 1));
    }

    map.set_stream_len(1000);
    let scaled = map.get(1000, None);
    assert_eq!(scaled.len(), 1000);
    for n in (1..=20).step_by(2) {
        assert_eq!(scaled[n * 10 - 1][0], (0, 1));
        assert_eq!(scaled[(n + 1) * 10 - 1][0], (1, 1));
    }
    for n in 201..1000 {
        assert_eq!(scaled[n].is_empty(), true);
    }

    map.set_stream_len(200);
    let scaled = map.get(20, Some((100, 150)));
    assert_eq!(scaled.len(), 20);
    assert_eq!(scaled[0][0], (1, 1));
    assert_eq!(scaled[1].is_empty(), true);
    assert_eq!(scaled[2].is_empty(), true);
    assert_eq!(scaled[3][0], (0, 1));
    assert_eq!(scaled[4].is_empty(), true);
    assert_eq!(scaled[5].is_empty(), true);
    assert_eq!(scaled[6].is_empty(), true);
    assert_eq!(scaled[7][0], (1, 1));
    assert_eq!(scaled[8].is_empty(), true);
    assert_eq!(scaled[9].is_empty(), true);
    assert_eq!(scaled[10].is_empty(), true);
    assert_eq!(scaled[11][0], (0, 1));
    assert_eq!(scaled[12].is_empty(), true);
    assert_eq!(scaled[13].is_empty(), true);
    assert_eq!(scaled[14].is_empty(), true);
    assert_eq!(scaled[15][0], (1, 1));
    assert_eq!(scaled[16].is_empty(), true);
    assert_eq!(scaled[17].is_empty(), true);
    assert_eq!(scaled[18].is_empty(), true);
    assert_eq!(scaled[19][0], (0, 1));

    map.set_stream_len(200);
    let scaled = map.get(10, Some((0, 200)));
    assert_eq!(scaled.len(), 10);
    for matches in scaled.iter() {
        assert_eq!(matches.len(), 2);
        if (matches[0] != (0, 1) && matches[1] != (1, 1))
            && (matches[0] != (1, 1) && matches[1] != (0, 1))
        {
            assert_eq!(true, false);
        }
    }

    map.set_stream_len(200);
    let scaled = map.get(400, Some((100, 150)));
    assert_eq!(scaled.len(), 51);
    assert_eq!(scaled[0][0], (1, 1));
    assert_eq!(scaled[10][0], (0, 1));
    assert_eq!(scaled[20][0], (1, 1));
    assert_eq!(scaled[30][0], (0, 1));
    assert_eq!(scaled[40][0], (1, 1));
    assert_eq!(scaled[50][0], (0, 1));

    map.set(Some(vec![
        (10, vec![0, 1, 2, 3]),
        (20, vec![1]),
        (30, vec![2]),
        (40, vec![3]),
        (50, vec![0, 1, 2, 3]),
        (60, vec![1]),
        (70, vec![2]),
        (80, vec![3]),
        (90, vec![0, 1, 2, 3]),
        (100, vec![1]),
        (110, vec![2]),
        (120, vec![3]),
        (130, vec![0, 1, 2, 3]),
        (140, vec![1]),
        (150, vec![2]),
        (160, vec![3]),
        (170, vec![0, 1, 2, 3]),
        (180, vec![1]),
        (190, vec![2]),
        (200, vec![3]),
    ]));

    map.set_stream_len(200);
    let scaled = map.get(10, None);
    assert_eq!(scaled.len(), 10);
    assert_eq!(scaled[0], vec![(0, 1), (1, 2), (2, 1), (3, 1)]);
    assert_eq!(scaled[1], vec![(2, 1), (3, 1)]);
    assert_eq!(scaled[2], vec![(0, 1), (1, 2), (2, 1), (3, 1)]);
    assert_eq!(scaled[3], vec![(2, 1), (3, 1)]);
    assert_eq!(scaled[4], vec![(0, 1), (1, 2), (2, 1), (3, 1)]);
    assert_eq!(scaled[5], vec![(2, 1), (3, 1)]);
    assert_eq!(scaled[6], vec![(0, 1), (1, 2), (2, 1), (3, 1)]);
    assert_eq!(scaled[7], vec![(2, 1), (3, 1)]);
    assert_eq!(scaled[8], vec![(0, 1), (1, 2), (2, 1), (3, 1)]);
    assert_eq!(scaled[9], vec![(2, 1), (3, 1)]);
}

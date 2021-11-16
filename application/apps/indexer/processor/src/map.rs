use serde::Serialize;
use std::collections::HashMap;

/// When looking at the search results of a file, we can say that
/// we have n results in row m
/// That allows us to depict the distribution of search matches over a file.
/// Note that since we do not need to keep track of each individual row,
/// we create regions of the file that span possible multiple rows.
/// [0-12] []
type ScaledDistribution = Vec<Vec<(u8, u16)>>;

/// Lists all matching filters at an index
#[derive(Debug, Clone)]
pub struct FilterMatch {
    pub index: u64,
    pub filters: Vec<u8>,
}

impl FilterMatch {
    pub fn new(index: u64, filters: Vec<u8>) -> Self {
        Self { index, filters }
    }
}

#[derive(Default, Debug, Serialize)]
pub struct NearestPosition {
    pub index: u64,    // Position in search results
    pub position: u64, // Position in original stream/file
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
#[derive(Default, Debug, Clone)]
pub struct SearchMap {
    matches: Vec<FilterMatch>,
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
    pub fn scaled(&self, dataset_len: u16, range: Option<(u64, u64)>) -> ScaledDistribution {
        let mut map: ScaledDistribution = vec![];
        if let Some((from, to)) = range {
            let range_len = to - from;
            let rate: f64 = (range_len as f64) / (dataset_len as f64);
            let mut cursor: usize = 0;
            if rate <= 1.0 {
                loop {
                    if self.matches[cursor].index >= from {
                        break;
                    } else {
                        cursor += 1;
                    }
                }
                for n in 0..=range_len {
                    if cursor < self.matches.len() {
                        if self.matches[cursor].index == from + n {
                            map.push(
                                self.matches[cursor]
                                    .filters
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
                                || self.matches[cursor].index > last_pos_in_results
                            {
                                break;
                            }
                            if self.matches[cursor].index < first_pos_in_results {
                                cursor += 1;
                                continue;
                            }
                            for filter_ref in &self.matches[cursor].filters {
                                *segment.entry(*filter_ref).or_insert(0) += 1;
                            }
                            cursor += 1;
                        }
                        let mut filter_matches: Vec<(u8, u16)> = segment.into_iter().collect();
                        filter_matches.sort_by_key(|k| k.0);
                        map.push(filter_matches.into_iter().collect());
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
                        if (self.matches[cursor]).index == n {
                            map.push(
                                self.matches[cursor]
                                    .filters
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
                                || self.matches[cursor].index > last_pos_in_segment
                            {
                                break;
                            }
                            for filter_ref in &self.matches[cursor].filters {
                                *segment.entry(*filter_ref).or_insert(0) += 1;
                            }
                            cursor += 1;
                        }
                        let mut filter_matches: Vec<(u8, u16)> = segment.into_iter().collect();
                        filter_matches.sort_by_key(|k| k.0);
                        map.push(filter_matches.into_iter().collect());
                    } else {
                        map.push(vec![]);
                        cursor += 1;
                    }
                }
            }
        }
        map
    }

    /// Takes position of row in main stream/file and try to find
    /// relevant nearest position in search results.
    /// For example, search results are (indexes or rows):
    /// [10, 200, 300, 350]
    /// In that case nearest for 310 will be 300
    /// Returns None if there are no search results
    pub fn nearest_to(&self, position_in_stream: u64) -> Option<NearestPosition> {
        if self.matches.is_empty() {
            None
        } else {
            let mut distance: i64 = i64::MAX;
            let mut index: u64 = 0;
            let mut position: u64 = 0;
            for (position_in_search, filter_match) in self.matches.iter().enumerate() {
                let diff = (position_in_stream as i64 - filter_match.index as i64).abs();
                if diff < distance {
                    distance = diff;
                    position = filter_match.index;
                    index = position_in_search as u64;
                }
            }
            if distance == i64::MAX {
                None
            } else {
                Some(NearestPosition { index, position })
            }
        }
    }

    pub fn set(&mut self, matches: Option<Vec<FilterMatch>>) {
        if let Some(matches) = matches {
            self.matches = matches;
        } else {
            self.matches = vec![];
        }
    }

    pub fn set_stream_len(&mut self, len: u64) {
        self.stream_len = len;
    }

    pub fn append(&mut self, matches: &mut Vec<FilterMatch>) {
        self.matches.append(matches);
    }
}

#[test]
fn test_scaled_map() {
    let mut example_map: SearchMap = SearchMap::new();
    example_map.set(Some(vec![
        FilterMatch::new(10, vec![0]),
        FilterMatch::new(20, vec![1]),
        FilterMatch::new(30, vec![0]),
        FilterMatch::new(40, vec![1]),
        FilterMatch::new(50, vec![0]),
        FilterMatch::new(60, vec![1]),
        FilterMatch::new(70, vec![0]),
        FilterMatch::new(80, vec![1]),
        FilterMatch::new(90, vec![0]),
        FilterMatch::new(100, vec![1]),
        FilterMatch::new(110, vec![0]),
        FilterMatch::new(120, vec![1]),
        FilterMatch::new(130, vec![0]),
        FilterMatch::new(140, vec![1]),
        FilterMatch::new(150, vec![0]),
        FilterMatch::new(160, vec![1]),
        FilterMatch::new(170, vec![0]),
        FilterMatch::new(180, vec![1]),
        FilterMatch::new(190, vec![0]),
        FilterMatch::new(200, vec![1]),
    ]));

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(10, None);
    assert_eq!(scaled.len(), 10);
    for matches in scaled.iter() {
        assert_eq!(matches.len(), 2);
        if (matches[0] != (0, 1) && matches[1] != (1, 1))
            && (matches[0] != (1, 1) && matches[1] != (0, 1))
        {
            assert_eq!(true, false);
        }
    }

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(5, None);
    assert_eq!(scaled.len(), 5);
    for matches in scaled.iter() {
        assert_eq!(matches.len(), 2);
        if (matches[0] != (0, 2) && matches[1] != (1, 2))
            && (matches[0] != (1, 2) && matches[1] != (0, 2))
        {
            assert_eq!(true, false);
        }
    }

    example_map.set_stream_len(1000);
    let scaled = example_map.scaled(10, None);
    assert_eq!(scaled.len(), 10);
    for (n, item) in scaled.iter().enumerate() {
        if n < 2 {
            assert_eq!(item[0], (0, 5));
            assert_eq!(item[1], (1, 5));
        } else {
            assert!(item.is_empty());
        }
    }

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(200, None);
    assert_eq!(scaled.len(), 200);
    for n in (1..=20).step_by(2) {
        assert_eq!(scaled[n * 10 - 1][0], (0, 1));
        assert_eq!(scaled[(n + 1) * 10 - 1][0], (1, 1));
    }

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(1000, None);
    assert_eq!(scaled.len(), 200);
    for n in (1..=20).step_by(2) {
        assert_eq!(scaled[n * 10 - 1][0], (0, 1));
        assert_eq!(scaled[(n + 1) * 10 - 1][0], (1, 1));
    }

    example_map.set_stream_len(1000);
    let scaled = example_map.scaled(1000, None);
    assert_eq!(scaled.len(), 1000);
    for n in (1..=20).step_by(2) {
        assert_eq!(scaled[n * 10 - 1][0], (0, 1));
        assert_eq!(scaled[(n + 1) * 10 - 1][0], (1, 1));
    }
    #[allow(clippy::needless_range_loop)]
    for n in 201..1000 {
        assert!(scaled[n].is_empty());
    }

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(20, Some((100, 150)));
    assert_eq!(scaled.len(), 20);
    assert_eq!(scaled[0][0], (1, 1));
    assert!(scaled[1].is_empty());
    assert!(scaled[2].is_empty());
    assert_eq!(scaled[3][0], (0, 1));
    assert!(scaled[4].is_empty());
    assert!(scaled[5].is_empty());
    assert!(scaled[6].is_empty());
    assert_eq!(scaled[7][0], (1, 1));
    assert!(scaled[8].is_empty());
    assert!(scaled[9].is_empty());
    assert!(scaled[10].is_empty());
    assert_eq!(scaled[11][0], (0, 1));
    assert!(scaled[12].is_empty());
    assert!(scaled[13].is_empty());
    assert!(scaled[14].is_empty());
    assert_eq!(scaled[15][0], (1, 1));
    assert!(scaled[16].is_empty());
    assert!(scaled[17].is_empty());
    assert!(scaled[18].is_empty());
    assert_eq!(scaled[19][0], (0, 1));

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(10, Some((0, 200)));
    assert_eq!(scaled.len(), 10);
    for matches in scaled.iter() {
        assert_eq!(matches.len(), 2);
        if (matches[0] != (0, 1) && matches[1] != (1, 1))
            && (matches[0] != (1, 1) && matches[1] != (0, 1))
        {
            assert_eq!(true, false);
        }
    }

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(400, Some((100, 150)));
    assert_eq!(scaled.len(), 51);
    assert_eq!(scaled[0][0], (1, 1));
    assert_eq!(scaled[10][0], (0, 1));
    assert_eq!(scaled[20][0], (1, 1));
    assert_eq!(scaled[30][0], (0, 1));
    assert_eq!(scaled[40][0], (1, 1));
    assert_eq!(scaled[50][0], (0, 1));

    example_map.set(Some(
        vec![
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
        ]
        .into_iter()
        .map(|(a, b)| FilterMatch::new(a, b))
        .collect(),
    ));

    example_map.set_stream_len(200);
    let scaled = example_map.scaled(10, None);
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

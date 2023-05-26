use crate::events::CallbackEvent;
use log::{debug, error};
use serde::{ser::SerializeTuple, Serialize, Serializer};
use std::{cmp::Ordering, collections::HashMap, ops::RangeInclusive};
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;

///(row_number, min_value_in_range, max_value_in_range, value)
/// value - can be last value in range or some kind of average
// pub type Point = (u64, f64, f64, f64);
#[derive(Debug, Clone)]
pub struct CandlePoint {
    row: u64,
    min_max_y: Option<(f64, f64)>,
    y_value: f64,
}

impl Serialize for CandlePoint {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let (min, max) = self.min_max_y.unwrap_or((0.0, 0.0));
        let mut tup = serializer.serialize_tuple(3)?;
        tup.serialize_element(&self.row)?;
        tup.serialize_element(&min)?;
        tup.serialize_element(&max)?;
        tup.serialize_element(&self.y_value)?;
        tup.end()
    }
}

impl From<(u64, f64)> for CandlePoint {
    fn from(point: (u64, f64)) -> Self {
        CandlePoint::new(point.0, point.1)
    }
}

impl CandlePoint {
    pub fn new(row: u64, y: f64) -> Self {
        Self {
            row,
            min_max_y: None,
            y_value: y,
        }
    }
}
type Point2D = (f64, f64);

#[derive(Error, Debug)]
pub enum ValuesError {
    #[error("Invalid frame")]
    InvalidFrame,
}

#[derive(Debug)]
pub struct Values {
    #[allow(clippy::type_complexity)]
    /// maps the dataset id to (max_x, min_y, max_y, list of data-points)
    values: HashMap<u8, (u64, f64, f64, Vec<CandlePoint>)>,
    errors: HashMap<u64, Vec<(u8, String)>>,
    tx_callback_events: Option<UnboundedSender<CallbackEvent>>,
}

impl Values {
    pub fn new(tx_callback_events: Option<UnboundedSender<CallbackEvent>>) -> Self {
        Values {
            values: HashMap::new(),
            errors: HashMap::new(),
            tx_callback_events,
        }
    }

    /// Drops all values and errors
    pub(crate) fn drop(&mut self) {
        self.errors.clear();
        self.values.clear();
        self.notify(true);
    }

    /// Overwrite set of data
    pub(crate) fn set_values(&mut self, values: HashMap<u8, Vec<(u64, f64)>>) {
        for (value_set_id, vs) in values {
            let min = Values::min(&vs);
            let max = Values::max(&vs);
            let max_row = Values::max_row(&vs);
            let v: Vec<CandlePoint> = vec![];
            let candle_points = vs.iter().fold(v, |mut acc, p| {
                acc.push((*p).into());
                acc
            });
            self.values
                .insert(value_set_id, (max_row, min, max, candle_points));
        }
        self.notify(false);
    }

    /// Append new chunk of data to existed
    pub(crate) fn append_values(&mut self, values: HashMap<u8, Vec<(u64, f64)>>) {
        for (value_set_id, vs) in values {
            let max_row = Values::max_row(&vs);
            let upd_min = Values::min(&vs);
            let upd_max = Values::max(&vs);
            if let Some((max_row, min, max, values)) = self.values.get_mut(&value_set_id) {
                for v in vs {
                    values.push(v.into())
                }
                *min = if &upd_min < min { upd_min } else { *min };
                *max = if &upd_max > max { upd_max } else { *max };
            } else {
                self.values.insert(
                    value_set_id,
                    (
                        max_row,
                        upd_min,
                        upd_max,
                        vs.into_iter().map(|v| v.into()).collect(),
                    ),
                );
            }
        }
        self.notify(false);
    }

    pub(crate) fn get(
        &self,
        frame: Option<RangeInclusive<u64>>,
        width: u16,
    ) -> Result<HashMap<u8, Vec<CandlePoint>>, ValuesError> {
        use std::time::Instant;
        let now = Instant::now();
        let maybe_fragment = self.get_fragment(frame)?;
        debug!("get_fragment took  {:.2?}", now.elapsed());
        let maybe_fragment_ref = maybe_fragment.as_ref();
        let excerpt = if let Some(fragment) = maybe_fragment_ref {
            fragment
        } else {
            &self.values
        };
        let mut datasets: HashMap<u8, Vec<CandlePoint>> = HashMap::new();
        excerpt.iter().for_each(|(k, (max_row, min, max, fragment))| {
            // let points = fragment
            //     .iter()
            //     .map(|p| (p.row as f64, p.y_value))
            //     .collect::<Vec<Point2D>>();
            let delta_y = max - min;
            let epsilon = delta_y / 10.0;
            let now_reduce = Instant::now();
            // let reduced = douglas_peucker(points, epsilon);
            let fragment = Clone::clone(fragment);// TODO oliver maybe we don't need that clone
            let fragment_len = fragment.len();
            let reduced = if width as usize <= fragment.len() {
                candled_graph(fragment, width, *max_row)
            } else {
                fragment
                // points
                //     .iter()
                //     .map(|(r, v)| CandlePoint::new(*r as u64, *v))
                //     .collect::<Vec<CandlePoint>>()
            };
            debug!("last candle: {:?}", reduced.last());

            debug!(
                "width: {width}, {} points reduced to: {} (epsilon {}, min: {min}, max: {max}, took {:.2?})",
                fragment_len,
                reduced.len(),
                epsilon,
                now_reduce.elapsed()
            );
            let fragment_set = reduced;
            // .iter()
            // .map(|(r, v)| CandlePoint::new(*r as u64, *v))
            // .collect::<Vec<CandlePoint>>();
            datasets.insert(*k, fragment_set);
        });
        for (key, value) in &datasets {
            debug!("dataset size for key {}: {}", key, value.len());
        }
        debug!("get alltogether took  {:.2?}", now.elapsed());
        Ok(datasets)
    }

    #[allow(clippy::type_complexity)]
    fn get_fragment(
        &self,
        frame: Option<RangeInclusive<u64>>,
    ) -> Result<Option<HashMap<u8, (u64, f64, f64, Vec<CandlePoint>)>>, ValuesError> {
        match frame {
            None => Ok(None),
            Some(frame) => {
                if frame.end() - frame.start() == 0 {
                    return Err(ValuesError::InvalidFrame);
                }
                let mut excerpt: HashMap<u8, (u64, f64, f64, Vec<CandlePoint>)> = HashMap::new();
                self.values.iter().for_each(|(k, (max_row, min, max, v))| {
                    let mut included: Vec<CandlePoint> = vec![];
                    let mut borders: (Option<&CandlePoint>, Option<&CandlePoint>) = (None, None);
                    for pair in v {
                        if &pair.row >= frame.start() && &pair.row <= frame.end() {
                            included.push(Clone::clone(pair));
                        } else if &pair.row <= frame.start() {
                            borders.0 = Some(pair);
                        }
                        if &pair.row >= frame.end() {
                            borders.1 = Some(pair);
                            break;
                        }
                    }
                    if let (Some(right), Some(left)) = (included.first(), borders.0) {
                        if right.row > *frame.start() {
                            included.insert(0, Values::between(left, right, frame.start()));
                        }
                    }
                    if let (Some(left), Some(right)) = (included.last(), borders.1) {
                        if left.row < *frame.end() {
                            included.push(Values::between(left, right, frame.end()));
                        }
                    }
                    if included.is_empty() {
                        if let (Some(left), Some(right)) = (borders.0, borders.1) {
                            included.push(Values::between(left, right, frame.start()));
                            included.push(Values::between(left, right, frame.end()));
                        }
                    }
                    excerpt.insert(*k, (*max_row, *min, *max, included));
                });
                Ok(Some(excerpt))
            }
        }
    }

    fn between(left: &CandlePoint, right: &CandlePoint, pos: &u64) -> CandlePoint {
        let pos_distance = right.row - left.row;
        let value_diff = right.y_value - left.y_value;
        let step = value_diff / pos_distance as f64;
        CandlePoint::new(*pos, (pos - left.row) as f64 * step + left.y_value)
    }

    fn min<T>(values: &[(T, f64)]) -> f64 {
        let iter = values.iter().map(|p| &p.1);
        *iter
            .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(&0f64)
    }

    fn max<T>(values: &[(T, f64)]) -> f64 {
        let iter = values.iter().map(|p| &p.1);
        *iter
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(&0f64)
    }

    fn max_row<T>(values: &[(u64, T)]) -> u64 {
        let iter = values.iter().map(|p| &p.0);
        *iter.max().unwrap_or(&0)
    }

    /// Send notification to client about updated state
    fn notify(&self, dropped: bool) {
        if let Some(tx) = self.tx_callback_events.as_ref() {
            let map = if dropped {
                None
            } else {
                let mut map: HashMap<u8, Point2D> = HashMap::new();
                self.values.iter().for_each(|(k, (max_row, min, max, _v))| {
                    map.insert(*k, (*min, *max));
                });
                Some(map)
            };
            if tx.send(CallbackEvent::SearchValuesUpdated(map)).is_err() {
                error!("Fail to emit event CallbackEvent::SearchValuesUpdated");
            }
        }
    }
}

pub fn perpendicular_distance(equation: &LineEquation, pm: Point2D) -> f64 {
    (equation.a * pm.0 + equation.b * pm.1 + equation.c).abs()
        / (equation.a.powi(2) + equation.b.powi(2)).sqrt()
}
pub struct LineEquation {
    a: f64,
    b: f64,
    c: f64,
}

fn standard_form_linear_equation(p1: Point2D, p2: Point2D) -> LineEquation {
    let a = p2.1 - p1.1;
    let b = p1.0 - p2.0;
    let c = p1.1 * (p2.0 - p1.0) - (p2.1 - p1.1) * p1.0;
    LineEquation { a, b, c }
}

fn _debug_points(points: &[Point2D], indexes: &RangeInclusive<usize>) {
    points.iter().enumerate().for_each(|(i, p)| {
        if indexes.contains(&i) {
            println!("=> {i}:{p:?}");
        } else {
            println!("{i}:{p:?}");
        }
    });
}

fn average(points: &[CandlePoint]) -> f64 {
    points.iter().fold(0f64, |mut acc, p| {
        acc += p.y_value;
        acc
    }) / points.len() as f64
}

fn median(points: &mut [Point2D]) -> f64 {
    points.sort_by(|p1, p2| p1.0.partial_cmp(&p2.0).unwrap_or(std::cmp::Ordering::Equal));
    let mid = points.len() / 2;
    points[mid].1
}

fn candled_graph(points: Vec<CandlePoint>, width: u16, max_row: u64) -> Vec<CandlePoint> {
    let per_slot: f64 = max_row as f64 / width as f64;
    let mut slots: Vec<Vec<CandlePoint>> = vec![];
    let mut slot_nr = 1usize;
    let mut slot_vec: Vec<CandlePoint> = vec![];
    for point in points {
        loop {
            let slot_end = slot_nr as f64 * per_slot;
            if (point.row as f64).total_cmp(&slot_end) == Ordering::Less {
                slot_vec.push(point.clone());
                break;
            } else {
                slots.push(slot_vec);
                slot_vec = vec![];
                slot_nr += 1;
            }
        }
    }
    slots.iter().fold(vec![], |mut acc, points_in_slot| {
        let med = average(points_in_slot);
        let min = 0f64; // TODO calculate minimum value of points_in_slot
        let max = 0f64;
        let real_row = acc.len() as f64 * per_slot;
        acc.push(CandlePoint {
            row: real_row as u64,
            min_max_y: Some((min, max)),
            y_value: med,
        });
        acc
    })
}

fn douglas_peucker(points: Vec<Point2D>, epsilon: f64) -> Vec<Point2D> {
    use std::time::Instant;
    let now = Instant::now();
    if points.len() <= 2 {
        return points.iter().enumerate().fold(vec![], |mut acc, (i, _)| {
            acc.push(points[i]);
            acc
        });
    }
    let mut ranges = Vec::<RangeInclusive<usize>>::new();

    let mut results = Vec::new();
    results.push(points[0]); // We always keep the starting point

    // Set of ranges to work through
    ranges.push(0..=points.len() - 1);
    let mut range_nr = 1usize;

    while let Some(range) = ranges.pop() {
        let range_start = *range.start();
        let range_end = *range.end();
        let p_start = points[range_start];
        let p_end = points[range_end];
        let line_equation = standard_form_linear_equation(p_start, p_end);
        let (d_max, i_max) = points[range_start + 1..range_end].iter().enumerate().fold(
            (0f64, 0),
            |(max_d, max_i), (i, p)| {
                let d = perpendicular_distance(&line_equation, *p);
                if d > max_d {
                    (d, i + 1)
                } else {
                    (max_d, max_i)
                }
            },
        );
        if d_max > epsilon {
            let division_point = range_start + i_max;
            let first_section = range_start..=division_point;
            let second_section = division_point..=range_end;
            let keep_first_section = division_point - range_start >= 2;
            let keep_second_section = range_end - division_point >= 2;
            if keep_second_section {
                ranges.push(second_section);
                range_nr += 1;
            }
            if keep_first_section {
                ranges.push(first_section);
                range_nr += 1;
            } else {
                results.push(points[division_point]);
            }
            if !keep_second_section {
                results.push(points[range_end]);
            }
        } else {
            results.push(points[range_end]);
        }
    }
    debug!(
        "smoothing with {} ranges took  {:.2?}",
        range_nr,
        now.elapsed(),
    );
    let now_sort = Instant::now();
    results.sort_by(|p1, p2| p1.0.partial_cmp(&p2.0).unwrap());
    debug!("sorting took  {:.2?}", now_sort.elapsed());
    results
}

mod test {
    use super::*;

    #[test]
    fn test_perpendicular() {
        let p1 = (1.0, 1.0);
        let p2 = (7.0, 4.0);
        let pm = (4.0, 5.0);
        let equation = standard_form_linear_equation(p1, p2);
        let dist = perpendicular_distance(&equation, pm);
        assert!((dist - 2.236f64).abs() < 0.001);
        let p1 = (1.0, -1.0);
        let p2 = (-7.0, 4.0);
        let pm = (4.0, 25.0);
        let equation = standard_form_linear_equation(p1, p2);
        let dist = perpendicular_distance(&equation, pm);
        assert!((dist - 23.637952724).abs() < 0.001);
    }
    fn _indexes_to_points(ixs: &[usize], points: &[Point2D]) -> Vec<Point2D> {
        ixs.iter().map(|i| points[*i]).collect()
    }
    #[test]
    fn small_vector() {
        let points = vec![
            (0.0, 0.0), //
            (4.0, 0.0), //
        ];
        let expected = _indexes_to_points(&[0, 1], &points);
        let actual = douglas_peucker(points, 1.0);
        assert_eq!(expected, actual);

        let points = vec![
            (0.0, 0.0),
            (5.0, 4.0),
            (11.0, 5.5),
            (17.3, 3.2),
            (27.8, 0.1),
        ];
        let expected = _indexes_to_points(&[0, 1, 2, 4], &points);
        let actual = douglas_peucker(points, 1.0);
        assert_eq!(expected, actual);
    }
    #[test]
    fn within_epsilon() {
        let points = vec![
            (0.0, 0.0),  //
            (1.0, 0.5),  //
            (2.0, -0.9), //
            (3.0, 0.3),  //
            (4.0, 0.0),  //
        ];

        let expected = _indexes_to_points(&[0, 4], &points);
        let actual = douglas_peucker(points, 1.0);
        assert_eq!(expected, actual);

        let points = vec![
            (0.0, 0.0),   // 0
            (3.0, 8.0),   // 1
            (5.0, 2.0),   // 2
            (5.0, 4.0),   // 3
            (6.0, 20.0),  // 4
            (6.4, 15.5),  // 5
            (7.0, 25.0),  // 6
            (9.1, 16.9),  // 7
            (10.0, 10.0), // 8
            (11.0, 5.5),  // 9
            (17.3, 3.2),  // 10
            (27.8, 0.1),  // 11
        ];
        let expected = _indexes_to_points(&[0, 1, 2, 6, 9, 11], &points);
        let actual = douglas_peucker(points, 1.5);
        assert_eq!(expected, actual);
    }

    #[test]
    fn test_two() {
        // Point sequence with only two elements.
        let points: Vec<(f64, f64)> = vec![(0.0, 0.0), (4.0, 4.0)];
        let expected = _indexes_to_points(&[0, 1], &points);
        let actual = douglas_peucker(points, 1.0);
        assert_eq!(expected, actual);
    }
}

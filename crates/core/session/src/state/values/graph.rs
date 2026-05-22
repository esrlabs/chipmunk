use std::{cmp::Ordering, ops::RangeInclusive};

use log::debug;
use processor::search::searchers::values::ValueSearchMatch;
use serde::{Serialize, Serializer, ser::SerializeTuple};

pub type Point2D = (f64, f64);
///(row_number, min_value_in_range, max_value_in_range, value)
/// value - can be last value in range or some kind of average
#[derive(Debug, Clone)]
pub struct CandlePoint {
    pub(crate) row: u64,
    min_max_y: Option<(f64, f64)>,
    y_value: f64,
}

impl From<CandlePoint> for stypes::Point {
    fn from(v: CandlePoint) -> Self {
        let (min, max) = v.min_max_y.unwrap_or((v.y_value, v.y_value));
        stypes::Point {
            row: v.row,
            min,
            max,
            y_value: v.y_value,
        }
    }
}

impl Serialize for CandlePoint {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let (min, max) = self.min_max_y.unwrap_or((self.y_value, self.y_value));
        let mut tup = serializer.serialize_tuple(3)?;
        tup.serialize_element(&self.row)?;
        tup.serialize_element(&min)?;
        tup.serialize_element(&max)?;
        tup.serialize_element(&self.y_value)?;
        tup.end()
    }
}

impl From<ValueSearchMatch> for CandlePoint {
    fn from(point: ValueSearchMatch) -> Self {
        CandlePoint::new(point.line, point.value)
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

    pub fn row_inside(&self, frame: &RangeInclusive<u64>) -> bool {
        &self.row >= frame.start() && &self.row <= frame.end()
    }

    pub fn row_before(&self, frame: &RangeInclusive<u64>) -> bool {
        &self.row < frame.start()
    }

    pub fn row_after(&self, frame: &RangeInclusive<u64>) -> bool {
        &self.row > frame.end()
    }

    pub fn between(left: &CandlePoint, right: &CandlePoint, pos: &u64) -> CandlePoint {
        let pos_distance = right.row - left.row;
        let value_diff = right.y_value - left.y_value;
        let step = value_diff / pos_distance as f64;
        CandlePoint::new(*pos, (pos - left.row) as f64 * step + left.y_value)
    }
}

fn average_min_max(points: &[CandlePoint]) -> (f64, f64, f64) {
    if points.is_empty() {
        return (0f64, 0f64, 0f64);
    }
    let (sum, min, max) = points.iter().fold((0f64, f64::MAX, 0f64), |mut acc, p| {
        acc.0 += p.y_value;
        acc.1 = acc.1.min(p.y_value);
        acc.2 = acc.2.max(p.y_value);
        acc
    });
    (sum / points.len() as f64, min, max)
}

#[allow(dead_code)]
fn median(points: &mut [Point2D]) -> f64 {
    points.sort_by(|p1, p2| p1.0.partial_cmp(&p2.0).unwrap_or(std::cmp::Ordering::Equal));
    let mid = points.len() / 2;
    points[mid].1
}

pub fn candled_graph(points: Vec<CandlePoint>, width: u16) -> Vec<CandlePoint> {
    let (first, delta_rows) = if let (Some(first), Some(last)) = (points.first(), points.last()) {
        (first.row, last.row - first.row)
    } else {
        (0, 0)
    };
    if delta_rows == 0 {
        return vec![];
    }
    let per_slot: f64 = delta_rows as f64 / width as f64;
    let mut slots: Vec<Vec<CandlePoint>> = vec![];
    let mut slot_nr = 1usize;
    let mut slot_vec: Vec<CandlePoint> = vec![];
    let mut last_point = CandlePoint::new(first, 0.0);
    for point in points {
        loop {
            let slot_end = (slot_nr as f64 * per_slot) + first as f64;
            if (point.row as f64).total_cmp(&slot_end) == Ordering::Less {
                last_point = point.clone(); // remember last real point in case
                slot_vec.push(point);
                break;
            } else {
                if slot_vec.is_empty() {
                    // in case we do not have enough points for a section,
                    // reuse last known point
                    slot_vec.push(last_point.clone());
                }
                slots.push(slot_vec);
                slot_vec = vec![];
                slot_nr += 1;
            }
        }
    }
    slots.iter().fold(vec![], |mut acc, points_in_slot| {
        let (med, min, max) = average_min_max(points_in_slot);
        let row = if let Some(point) = points_in_slot.first() {
            point.row
        } else {
            (acc.len() as f64 * per_slot + first as f64) as u64
        };
        acc.push(CandlePoint {
            row,
            min_max_y: Some((min, max)),
            y_value: med,
        });
        acc
    })
}

#[allow(dead_code)]
pub fn perpendicular_distance(equation: &LineEquation, pm: Point2D) -> f64 {
    (equation.a * pm.0 + equation.b * pm.1 + equation.c).abs()
        / (equation.a.powi(2) + equation.b.powi(2)).sqrt()
}

#[allow(dead_code)]
// allows to represent the standard for line equations
// in this form: Ax+By=C
pub struct LineEquation {
    a: f64,
    b: f64,
    c: f64,
}

#[allow(dead_code)]
/// calculate the line equation for the line that contains 2 points
fn standard_form_linear_equation(p1: Point2D, p2: Point2D) -> LineEquation {
    let a = p2.1 - p1.1;
    let b = p1.0 - p2.0;
    let c = p1.1 * (p2.0 - p1.0) - (p2.1 - p1.1) * p1.0;
    LineEquation { a, b, c }
}

#[allow(dead_code)]
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

fn _debug_points(points: &[Point2D], indexes: &RangeInclusive<usize>) {
    points.iter().enumerate().for_each(|(i, p)| {
        if indexes.contains(&i) {
            println!("=> {i}:{p:?}");
        } else {
            println!("{i}:{p:?}");
        }
    });
}

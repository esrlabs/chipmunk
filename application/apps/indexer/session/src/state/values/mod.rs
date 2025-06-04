use log::{debug, error};
use std::{collections::HashMap, ops::RangeInclusive};
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;

pub mod graph;

use graph::{CandlePoint, Point2D, candled_graph};

#[derive(Error, Debug)]
pub enum ValuesError {
    #[error("Invalid frame: {0}")]
    InvalidFrame(String),
}

impl From<ValuesError> for stypes::NativeError {
    fn from(err: ValuesError) -> Self {
        stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

#[derive(Debug)]
pub struct Values {
    #[allow(clippy::type_complexity)]
    /// maps the dataset id to (min_y, max_y, list of data-points)
    values: HashMap<u8, (f64, f64, Vec<CandlePoint>)>,
    errors: HashMap<u64, Vec<(u8, String)>>,
    tx_callback_events: Option<UnboundedSender<stypes::CallbackEvent>>,
}

impl Values {
    pub fn new(tx_callback_events: Option<UnboundedSender<stypes::CallbackEvent>>) -> Self {
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
            let v: Vec<CandlePoint> = vec![];
            let candle_points = vs.iter().fold(v, |mut acc, p| {
                acc.push((*p).into());
                acc
            });
            self.values.insert(value_set_id, (min, max, candle_points));
        }
        self.notify(false);
    }

    /// Append new chunk of data to existed
    pub(crate) fn append_values(&mut self, values: HashMap<u8, Vec<(u64, f64)>>) {
        for (value_set_id, vs) in values {
            let upd_min = Values::min(&vs);
            let upd_max = Values::max(&vs);
            if let Some((min, max, values)) = self.values.get_mut(&value_set_id) {
                for v in vs {
                    values.push(v.into())
                }
                *min = if &upd_min < min { upd_min } else { *min };
                *max = if &upd_max > max { upd_max } else { *max };
            } else {
                self.values.insert(
                    value_set_id,
                    (upd_min, upd_max, vs.into_iter().map(|v| v.into()).collect()),
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
        excerpt.iter().for_each(|(k, (min, max, fragment))| {
            let delta_y = max - min;
            let epsilon = delta_y / 10.0;
            let now_reduce = Instant::now();
            // let reduced = douglas_peucker(points, epsilon);
            let fragment = Clone::clone(fragment);// TODO oliver maybe we don't need that clone
            let fragment_len = fragment.len();
            let reduced = if width as usize <= fragment.len() {
                candled_graph(fragment, width)
            } else {
                fragment
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
    ) -> Result<Option<HashMap<u8, (f64, f64, Vec<CandlePoint>)>>, ValuesError> {
        match frame {
            None => Ok(None),
            Some(frame) => {
                if frame.end() < frame.start() {
                    return Err(ValuesError::InvalidFrame(format!(
                        "[{}, {}]",
                        frame.start(),
                        frame.end()
                    )));
                }
                let mut excerpt: HashMap<u8, (f64, f64, Vec<CandlePoint>)> = HashMap::new();
                self.values.iter().for_each(|(k, (min, max, v))| {
                    let mut included: Vec<CandlePoint> = vec![];
                    let mut borders: (Option<&CandlePoint>, Option<&CandlePoint>) = (None, None);
                    for point in v {
                        if point.row_inside(&frame) {
                            included.push(Clone::clone(point));
                        } else if point.row_before(&frame) {
                            borders.0 = Some(point);
                        }
                        if point.row_after(&frame) {
                            borders.1 = Some(point);
                            break;
                        }
                    }
                    if let (Some(right_point), Some(left_left)) = (included.first(), borders.0) {
                        if right_point.row > *frame.start() {
                            included.insert(
                                0,
                                CandlePoint::between(left_left, right_point, frame.start()),
                            );
                        }
                    }
                    if let (Some(left), Some(right)) = (included.last(), borders.1) {
                        if left.row < *frame.end() {
                            included.push(CandlePoint::between(left, right, frame.end()));
                        }
                    }
                    if included.is_empty() {
                        if let (Some(left), Some(right)) = (borders.0, borders.1) {
                            included.push(CandlePoint::between(left, right, frame.start()));
                            included.push(CandlePoint::between(left, right, frame.end()));
                        }
                    }
                    excerpt.insert(*k, (*min, *max, included));
                });
                Ok(Some(excerpt))
            }
        }
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

    /// Send notification to client about updated state
    fn notify(&self, dropped: bool) {
        if let Some(tx) = self.tx_callback_events.as_ref() {
            let map = if dropped {
                None
            } else {
                let mut map: HashMap<u8, Point2D> = HashMap::new();
                self.values.iter().for_each(|(k, (min, max, _v))| {
                    map.insert(*k, (*min, *max));
                });
                Some(map)
            };
            if tx
                .send(stypes::CallbackEvent::SearchValuesUpdated(map))
                .is_err()
            {
                error!("Fail to emit event CallbackEvent::SearchValuesUpdated");
            }
        }
    }
}

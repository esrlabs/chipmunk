use crate::events::CallbackEvent;
use log::error;
use std::{collections::HashMap, ops::RangeInclusive};
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;

///(row_number, min_value_in_range, max_value_in_range, value)
/// value - can be last value in range or some kind of average
pub type Point = (u64, f64, f64, f64);

#[derive(Error, Debug)]
pub enum ValuesError {
    #[error("Invalid frame")]
    InvalidFrame,
    // #[error("IO error: {0:?}")]
    // Io(#[from] std::io::Error),
}

#[derive(Debug)]
pub struct Values {
    #[allow(clippy::type_complexity)]
    values: HashMap<u8, (f64, f64, Vec<(u64, f64)>)>,
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
    pub(crate) fn set_values(&mut self, mut values: HashMap<u8, Vec<(u64, f64)>>) {
        values
            .keys()
            .copied()
            .collect::<Vec<u8>>()
            .iter()
            .for_each(|k| {
                if let Some(v) = values.remove(k) {
                    let min = Values::min(&v);
                    let max = Values::max(&v);
                    self.values.insert(*k, (min, max, v));
                }
            });
        self.notify(false);
    }

    /// Append new chunk of data to existed
    pub(crate) fn append_values(&mut self, mut values: HashMap<u8, Vec<(u64, f64)>>) {
        values
            .keys()
            .copied()
            .collect::<Vec<u8>>()
            .iter()
            .for_each(|k| {
                if let Some(mut v) = values.remove(k) {
                    let upd_min = Values::min(&v);
                    let upd_max = Values::max(&v);
                    if let Some((min, max, values)) = self.values.get_mut(k) {
                        values.append(&mut v);
                        *min = if &upd_min < min { upd_min } else { *min };
                        *max = if &upd_max > max { upd_max } else { *max };
                    } else {
                        self.values.insert(*k, (upd_min, upd_max, v));
                    }
                }
            });
        self.notify(false);
    }

    pub(crate) fn get(
        &self,
        frame: &RangeInclusive<u64>,
        _width: u16,
    ) -> Result<HashMap<u8, Vec<Point>>, ValuesError> {
        let excerpt = self.get_fragment(frame)?;
        let mut datasets: HashMap<u8, Vec<Point>> = HashMap::new();
        excerpt.iter().for_each(|(k, fragment)| {
            datasets.insert(
                *k,
                fragment
                    .iter()
                    .map(|(r, v)| (*r, 0f64, 0f64, *v))
                    .collect::<Vec<Point>>(),
            );
        });
        Ok(datasets)
    }

    #[allow(clippy::type_complexity)]
    fn get_fragment(
        &self,
        frame: &RangeInclusive<u64>,
    ) -> Result<HashMap<u8, Vec<(u64, f64)>>, ValuesError> {
        if frame.end() - frame.start() == 0 {
            return Err(ValuesError::InvalidFrame);
        }
        let mut excerpt: HashMap<u8, Vec<(u64, f64)>> = HashMap::new();
        self.values.iter().for_each(|(k, (_min, _max, v))| {
            let mut included: Vec<(u64, f64)> = vec![];
            let mut borders: (Option<&(u64, f64)>, Option<&(u64, f64)>) = (None, None);
            for pair in v {
                if &pair.0 >= frame.start() && &pair.0 <= frame.end() {
                    included.push(*pair);
                } else if &pair.0 <= frame.start() {
                    borders.0 = Some(pair);
                }
                if &pair.0 >= frame.end() {
                    borders.1 = Some(pair);
                    break;
                }
            }
            if let (Some(right), Some(left)) = (included.first(), borders.0) {
                if right.0 > *frame.start() {
                    included.insert(0, Values::between(left, right, frame.start()));
                }
            }
            if let (Some(left), Some(right)) = (included.last(), borders.1) {
                if left.0 < *frame.end() {
                    included.push(Values::between(left, right, frame.end()));
                }
            }
            if included.is_empty() {
                if let (Some(left), Some(right)) = (borders.0, borders.1) {
                    included.push(Values::between(left, right, frame.start()));
                    included.push(Values::between(left, right, frame.end()));
                }
            }
            excerpt.insert(*k, included);
        });
        Ok(excerpt)
    }

    fn between(left: &(u64, f64), right: &(u64, f64), pos: &u64) -> (u64, f64) {
        let pos_distance = right.0 - left.0;
        let value_diff = right.1 - left.1;
        let step = value_diff / pos_distance as f64;
        (*pos, (pos - left.0) as f64 * step + left.1)
    }

    fn min(values: &[(u64, f64)]) -> f64 {
        let iter = values.iter().map(|(_p, v)| v);
        *iter
            .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(&0f64)
    }

    fn max(values: &[(u64, f64)]) -> f64 {
        let iter = values.iter().map(|(_p, v)| v);
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
                let mut map: HashMap<u8, (f64, f64)> = HashMap::new();
                self.values.iter().for_each(|(k, (min, max, _v))| {
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

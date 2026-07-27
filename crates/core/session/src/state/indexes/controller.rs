//! Includes the definitions and implementation of controller of search results view.

use std::ops::RangeInclusive;

use log::error;
use tokio::sync::mpsc::UnboundedSender;

use super::{IndexedNavigation, frame::Frame, map::Map, nature::Nature};

/// The controller of search results view.
#[derive(Debug)]
pub struct Controller {
    map: Map,
    tx_callback_events: Option<UnboundedSender<stypes::CallbackEvent>>,
}

impl Controller {
    pub(crate) fn new(tx_callback_events: Option<UnboundedSender<stypes::CallbackEvent>>) -> Self {
        Self {
            map: Map::new(),
            tx_callback_events,
        }
    }

    pub(crate) fn add_bookmark(&mut self, row: u64) {
        self.map.insert([row], Nature::BOOKMARK);
        self.notify();
    }

    pub(crate) fn remove_bookmark(&mut self, row: u64) {
        self.map.remove(&[row], Nature::BOOKMARK);
        self.notify();
    }

    pub(crate) fn set_bookmarks(&mut self, rows: Vec<u64>) {
        self.map.insert(rows, Nature::BOOKMARK);
        self.notify();
    }

    pub(crate) fn set_stream_len(&mut self, len: u64) {
        self.map.set_stream_len(len);
        self.notify();
    }

    pub(crate) fn drop_search(&mut self) {
        self.map.clean(Nature::SEARCH);
        self.notify();
    }

    pub(crate) fn set_search_results(&mut self, matches: &[stypes::FilterMatch]) {
        self.map.clean(Nature::SEARCH);
        self.map.insert(
            matches.iter().map(|filter_match| filter_match.index),
            Nature::SEARCH,
        );
        self.notify();
    }

    pub(crate) fn append_search_results(&mut self, matches: &[stypes::FilterMatch]) {
        self.map.insert(
            matches.iter().map(|filter_match| filter_match.index),
            Nature::SEARCH,
        );
        self.notify();
    }

    pub(crate) fn indexed_neighbor(
        &mut self,
        anchor: Option<u64>,
        direction: IndexedNavigation,
    ) -> Option<u64> {
        self.map.indexed_neighbor(anchor, direction)
    }

    /// Returns the exact indexed-table row for a session position.
    pub fn indexed_row_index(&mut self, session_position: u64) -> Result<u64, stypes::NativeError> {
        self.map.indexed_row_index(session_position)
    }

    /// Returns the indexed-table row nearest to a session position.
    pub fn nearest_indexed_row(
        &mut self,
        session_position: u64,
    ) -> Result<Option<u64>, stypes::NativeError> {
        self.map.nearest_indexed_row(session_position)
    }

    pub(crate) fn naturalize(&self, elements: &mut [stypes::GrabbedElement]) {
        self.map.naturalize(elements);
    }

    pub(crate) fn frame(
        &mut self,
        range: &mut RangeInclusive<u64>,
    ) -> Result<Frame, stypes::NativeError> {
        self.map.frame(range)
    }

    pub(crate) fn get_all_as_ranges(&self) -> Vec<RangeInclusive<u64>> {
        self.map.get_all_as_ranges()
    }

    pub(crate) fn len(&self) -> usize {
        self.map.len()
    }

    fn notify(&self) {
        if let Some(tx) = self.tx_callback_events.as_ref() {
            let event = stypes::CallbackEvent::IndexedMapUpdated {
                len: self.map.len() as u64,
            };
            if let Err(err) = tx.send(event) {
                error!("Fail to send indexed map notification: {err:?}");
            }
        }
    }
}

impl Default for Controller {
    fn default() -> Self {
        Self::new(None)
    }
}

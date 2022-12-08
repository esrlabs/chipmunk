use super::{frame::Frame, map::Map, nature::Nature};
use crate::events::{CallbackEvent, NativeError};
use log::error;
use processor::map::FilterMatch;
use std::ops::RangeInclusive;
use tokio::sync::mpsc::UnboundedSender;

const MIN_BREADCRUMBS_DISTANCE: u64 = 4;
const MIN_BREADCRUMBS_OFFSET: u64 = 2;

#[repr(u8)]
#[derive(Debug, PartialEq, Eq)]
pub enum Mode {
    Regular = 0u8,
    Breadcrumbs = 1u8,
    Selection = 2u8,
}

#[derive(Debug)]
pub struct Controller {
    map: Map,
    mode: Mode,
    tx_callback_events: Option<UnboundedSender<CallbackEvent>>,
}

impl Controller {
    pub fn new(tx_callback_events: Option<UnboundedSender<CallbackEvent>>) -> Self {
        Self {
            map: Map::new(),
            mode: Mode::Regular,
            tx_callback_events,
        }
    }

    pub fn set_mode(&mut self, mode: Mode) -> Result<(), NativeError> {
        if self.mode == mode {
            return Ok(());
        }
        match self.mode {
            Mode::Breadcrumbs => {
                self.map.clean(&Nature::Breadcrumb);
                self.map.clean(&Nature::BreadcrumbSeporator);
            }
            Mode::Selection => {
                if !matches!(mode, Mode::Breadcrumbs) {
                    // We don't need to remove selection if we are switchin to breadcrumbs
                    // mode, because selection will be removed with building of breadcrumbs.
                    self.map.clean(&Nature::Selection);
                }
            }
            _ => {
                // Nothing to do
            }
        }
        self.mode = mode;
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .build_breadcrumbs(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub fn add_bookmark(&mut self, row: u64) -> Result<(), NativeError> {
        self.map.insert(&[row], &Nature::Bookmark);
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .build_breadcrumbs(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub fn remove_bookmark(&mut self, row: u64) -> Result<(), NativeError> {
        self.map.remove(&[row], &Nature::Bookmark);
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .build_breadcrumbs(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub fn add_selection(&mut self, range: RangeInclusive<u64>) -> Result<(), NativeError> {
        self.set_mode(Mode::Selection)?;
        self.map.insert_range(range, &Nature::Selection);
        self.notify();
        Ok(())
    }

    pub fn remove_selection(&mut self, range: RangeInclusive<u64>) -> Result<(), NativeError> {
        self.map.remove_range(range, &Nature::Selection);
        self.notify();
        Ok(())
    }

    pub fn set_stream_len(&mut self, len: u64) -> Result<(), NativeError> {
        let prev = self.map.stream_len;
        if prev == len {
            return Ok(());
        }
        self.map.set_stream_len(len);
        let last_match = self
            .map
            .get_last_key_for_nature(&[Nature::Search, Nature::Bookmark]);
        if matches!(self.mode, Mode::Breadcrumbs) {
            if let Some(key) = last_match {
                self.map.update_breadcrumbs(
                    key,
                    MIN_BREADCRUMBS_DISTANCE,
                    MIN_BREADCRUMBS_OFFSET,
                )?;
            } else {
                self.map
                    .build_breadcrumbs(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
            }
        }
        self.notify();
        Ok(())
    }

    pub fn drop_search(&mut self) -> Result<(), NativeError> {
        self.map.clean(&Nature::Search);
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .build_breadcrumbs(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub fn append_search_results(&mut self, matches: &[FilterMatch]) -> Result<(), NativeError> {
        let last_match = self
            .map
            .get_last_key_for_nature(&[Nature::Search, Nature::Bookmark]);
        self.map.insert(
            &matches.iter().map(|f| f.index).collect::<Vec<u64>>()[..],
            &Nature::Search,
        );
        if matches!(self.mode, Mode::Breadcrumbs) {
            if let Some(key) = last_match {
                self.map.update_breadcrumbs(
                    key,
                    MIN_BREADCRUMBS_DISTANCE,
                    MIN_BREADCRUMBS_OFFSET,
                )?;
            } else {
                self.map
                    .build_breadcrumbs(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
            }
        }
        self.notify();
        Ok(())
    }

    pub fn extend_breadcrumbs(
        &mut self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), NativeError> {
        self.map.extend_breadcrumbs(seporator, offset, above)
    }

    pub fn frame(&self, range: &mut RangeInclusive<u64>) -> Result<Frame, NativeError> {
        self.map.frame(range)
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    fn notify(&self) {
        if let Some(tx) = self.tx_callback_events.as_ref() {
            if let Err(err) = tx.send(CallbackEvent::IndexedMapUpdated {
                len: self.map.len() as u64,
            }) {
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

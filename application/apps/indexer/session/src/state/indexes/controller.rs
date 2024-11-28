use super::{frame::Frame, map::Map, nature::Nature};
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
}

#[derive(Debug)]
pub struct Controller {
    map: Map,
    mode: Mode,
    tx_callback_events: Option<UnboundedSender<stypes::CallbackEvent>>,
}

impl Controller {
    pub(crate) fn new(tx_callback_events: Option<UnboundedSender<stypes::CallbackEvent>>) -> Self {
        Self {
            map: Map::new(),
            mode: Mode::Regular,
            tx_callback_events,
        }
    }

    pub(crate) fn set_mode(&mut self, mode: Mode) -> Result<(), stypes::NativeError> {
        if self.mode == mode {
            return Ok(());
        }
        match self.mode {
            Mode::Breadcrumbs => {
                self.map.clean(Nature::BREADCRUMB);
                self.map.clean(Nature::BREADCRUMB_SEPORATOR);
                self.map.clean(Nature::EXPANDED);
            }
            Mode::Regular => {
                // Nothing to do
            }
        }
        self.mode = mode;
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .breadcrumbs_build(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub(crate) fn add_bookmark(&mut self, row: u64) -> Result<(), stypes::NativeError> {
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map.breadcrumbs_insert_and_update(
                &[row],
                Nature::BOOKMARK,
                MIN_BREADCRUMBS_DISTANCE,
                MIN_BREADCRUMBS_OFFSET,
            )?;
        } else {
            self.map.insert(&[row], Nature::BOOKMARK);
        }
        self.notify();
        Ok(())
    }

    pub(crate) fn remove_bookmark(&mut self, row: u64) -> Result<(), stypes::NativeError> {
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .breadcrumbs_drop_and_update(&[row], Nature::BOOKMARK)?;
        } else {
            self.map.remove(&[row], Nature::BOOKMARK);
        }

        self.notify();
        Ok(())
    }

    pub(crate) fn set_bookmarks(&mut self, rows: Vec<u64>) -> Result<(), stypes::NativeError> {
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .breadcrumbs_drop_and_update(&rows, Nature::BOOKMARK)?;
            self.map.breadcrumbs_insert_and_update(
                &rows,
                Nature::BOOKMARK,
                MIN_BREADCRUMBS_DISTANCE,
                MIN_BREADCRUMBS_OFFSET,
            )?;
        } else {
            self.map.remove(&rows, Nature::BOOKMARK);
            self.map.insert(&rows, Nature::BOOKMARK);
        }
        self.notify();
        Ok(())
    }

    pub(crate) fn set_stream_len(&mut self, len: u64) -> Result<(), stypes::NativeError> {
        self.map.set_stream_len(
            len,
            MIN_BREADCRUMBS_DISTANCE,
            MIN_BREADCRUMBS_OFFSET,
            matches!(self.mode, Mode::Breadcrumbs),
        )?;
        self.notify();
        Ok(())
    }

    pub(crate) fn drop_search(&mut self) -> Result<(), stypes::NativeError> {
        self.map.clean(
            Nature::SEARCH
                .union(Nature::BREADCRUMB)
                .union(Nature::BREADCRUMB_SEPORATOR),
        );
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .breadcrumbs_build(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub(crate) fn set_search_results(
        &mut self,
        matches: &[FilterMatch],
    ) -> Result<(), stypes::NativeError> {
        self.map.clean(
            Nature::SEARCH
                .union(Nature::BREADCRUMB)
                .union(Nature::BREADCRUMB_SEPORATOR),
        );
        let collected = matches.iter().map(|f| f.index).collect::<Vec<u64>>();
        self.map.insert(&collected, Nature::SEARCH);
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map
                .breadcrumbs_build(MIN_BREADCRUMBS_DISTANCE, MIN_BREADCRUMBS_OFFSET)?;
        }
        self.notify();
        Ok(())
    }

    pub(crate) fn append_search_results(
        &mut self,
        matches: &[FilterMatch],
    ) -> Result<(), stypes::NativeError> {
        if matches!(self.mode, Mode::Breadcrumbs) {
            self.map.breadcrumbs_insert_and_update(
                &matches.iter().map(|f| f.index).collect::<Vec<u64>>(),
                Nature::SEARCH,
                4,
                2,
            )?
        } else {
            self.map.insert(
                &matches.iter().map(|f| f.index).collect::<Vec<u64>>(),
                Nature::SEARCH,
            );
        }
        self.notify();
        Ok(())
    }

    pub(crate) fn get_around_indexes(
        &mut self,
        position: &u64,
    ) -> Result<(Option<u64>, Option<u64>), stypes::NativeError> {
        self.map.get_around_indexes(position)
    }

    pub(crate) fn naturalize(&self, elements: &mut [stypes::GrabbedElement]) {
        self.map.naturalize(elements);
    }

    pub(crate) fn breadcrumbs_expand(
        &mut self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), stypes::NativeError> {
        self.map.breadcrumbs_expand(seporator, offset, above)?;
        self.notify();
        Ok(())
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

    #[must_use]
    pub(crate) fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn notify(&self) {
        if let Some(tx) = self.tx_callback_events.as_ref() {
            if let Err(err) = tx.send(stypes::CallbackEvent::IndexedMapUpdated {
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

use super::{frame::Frame, index::Index, map::Map, nature::Nature};
use crate::{
    events::{NativeError, NativeErrorKind},
    state::GrabbedElement,
};
use indexer_base::progress::Severity;
use std::{cmp, collections::BTreeMap, ops::RangeInclusive};

#[repr(u8)]
#[derive(Debug)]
pub enum Mode {
    Regular = 0u8,
    Breadcrumbs = 1u8,
    Selection = 2u8,
}

#[derive(Debug)]
pub struct IndexesController {
    pub map: Map,
    pub mode: Mode,
}

impl IndexesController {
    pub fn new() -> Self {
        Self {
            map: Map::new(),
            mode: Mode::Regular,
        }
    }
}

impl Default for IndexesController {
    fn default() -> Self {
        Self::new()
    }
}

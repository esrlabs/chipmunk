use super::{frame::Frame, keys::Keys, nature::Nature};
use log::error;
use rustc_hash::FxHashMap;
use std::{cmp, ops::RangeInclusive};

// This trigger is used to choose a way to remove key from a map.
// If count of keys, which should be removed grander than TRIGGER,
// whole map would be dropped and rebuilt; if not - keys will be
// removed one by one.
//
// Bench tests (creating ranges from indexes)
// keys: 800 000 000
// created ranges: 200 000 000 in 8923 ms (8923908630 nn)
// ==========================================================
// keys: 80 000 000
// created ranges: 20 000 000 in 366 ms (366996208 nn)
// ==========================================================
// keys: 8 000 000
// created ranges: 2 000 000 in 20 ms (20743126 nn)
// ==========================================================
// keys: 800 000
// created ranges: 200 000 in 4 ms (4432853 nn)
// ==========================================================
// keys: 80 000
// created ranges: 20 000 in 0 ms (433805 nn)
// ==========================================================
// Conclusion: ranges could be created if keys < ~100K
//
// Bench tests (removing keys one by one with binary search)
// keys: 80 000
// removed keys: 80 000 in 681 ms (681925515 nn)
// ==========================================================
// keys: 8 000
// removed keys: 8 000 in 4 ms (4864688 nn)
// ==========================================================
// keys: 800
// removed keys: 800 in 0 ms (59724 nn)
// ==========================================================
// Conclusion: removing keys one by one reasonable if keys <= ~1K

const KEYS_ITERATIONS_LIMIT: usize = 500; // based on bench test < 1K
const RANGES_LIMIT: usize = 10000; // based on bench test < 100K

#[derive(Debug)]
pub struct Map {
    indexes: FxHashMap<u64, Nature>,
    keys: Keys,
    pub stream_len: u64,
}

impl Map {
    pub fn new() -> Self {
        Self {
            indexes: FxHashMap::default(),
            keys: Keys::new(),
            stream_len: 0,
        }
    }

    fn as_ranges(values: &mut [u64]) -> Option<Vec<RangeInclusive<u64>>> {
        if values.len() > RANGES_LIMIT {
            return None;
        }
        let mut ranges = vec![];
        let mut from: u64 = 0;
        let mut to: u64 = 0;
        values.sort();
        for (i, value) in values.iter().enumerate() {
            if i == 0 {
                from = *value;
            } else if to + 1 != *value {
                ranges.push(RangeInclusive::new(from, to));
                if ranges.len() >= KEYS_ITERATIONS_LIMIT {
                    return None;
                }
                from = *value;
            }
            to = *value;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from)
            || (ranges.is_empty() && !values.is_empty())
        {
            ranges.push(RangeInclusive::new(from, to));
        }
        Some(ranges)
    }

    pub fn get_all_as_ranges(&self) -> Vec<RangeInclusive<u64>> {
        self.keys.as_ranges()
    }

    fn index_add(&mut self, position: u64, nature: Nature) {
        if self.indexes.insert(position, nature).is_none() {
            self.keys.add(position);
        }
    }

    fn index_remove(&mut self, position: &u64, remove_key: bool) {
        self.indexes.remove(position);
        if remove_key {
            self.keys.remove(position);
        }
    }

    fn indexes_remove(&mut self, positions: &mut [u64]) {
        let ranges = Self::as_ranges(positions);
        positions.iter().for_each(|p| {
            self.index_remove(p, false);
        });
        let drop = if let Some(ranges) = ranges.as_ref() {
            if let Err(err) = self.keys.remove_ranges(ranges) {
                error!("Cannot cleanup keys by ranges: {err}; map will be dropped");
                true
            } else {
                false
            }
        } else {
            true
        };
        if drop {
            self.keys
                .clear()
                .import(self.indexes.keys().cloned().collect::<Vec<u64>>());
        }
    }

    fn insert_range(&mut self, range: RangeInclusive<u64>, nature: Nature) {
        let positions = range.collect::<Vec<u64>>();
        self.insert(&positions, nature);
    }

    fn remove_from(&mut self, position: &u64) -> Result<(), stypes::NativeError> {
        let removed = self.keys.remove_from(position)?;
        removed.iter().for_each(|position| {
            self.indexes.remove(position);
        });
        Ok(())
    }

    fn remove_if(&mut self, position: u64, nature: Nature) {
        if let Some(index) = self.indexes.get_mut(&position) {
            if index == &nature {
                self.index_remove(&position, true);
            }
        }
    }

    pub fn insert(&mut self, positions: &[u64], nature: Nature) {
        positions.iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(position) {
                index.include(nature);
            } else {
                self.index_add(*position, nature);
            }
        });
    }

    pub fn remove(&mut self, positions: &[u64], nature: Nature) {
        let mut to_be_removed = Vec::new();
        positions.iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(position) {
                index.exclude(nature);
                if index.is_empty() {
                    to_be_removed.push(*position);
                }
            }
        });
        self.indexes_remove(&mut to_be_removed);
    }

    pub fn naturalize(&self, elements: &mut [stypes::GrabbedElement]) {
        elements.iter_mut().for_each(|el| {
            if let Some(nature) = self.indexes.get(&(el.pos as u64)) {
                el.set_nature(nature.bits());
            }
            // It's normal use-case when element isn't in indexed map. In this case nature will be
            // equal to 0
        });
    }

    pub fn get_around_indexes(
        &mut self,
        position: &u64,
    ) -> Result<(Option<u64>, Option<u64>), stypes::NativeError> {
        self.keys.get_positions_around(position)
    }

    fn breadcrumbs_insert_between(
        &mut self,
        range: RangeInclusive<u64>,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), stypes::NativeError> {
        let start_pos = *range.start();
        let end_pos = *range.end();
        if end_pos >= self.stream_len {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Invalid index: {end_pos}. Map len: {};",
                    self.indexes.len()
                )),
            });
        }
        let distance = end_pos - start_pos;
        if distance <= 1 {
            if !self.indexes.contains_key(&start_pos) {
                self.insert(&[start_pos], Nature::BREADCRUMB);
            }
            if !self.indexes.contains_key(&end_pos) {
                self.insert(&[end_pos], Nature::BREADCRUMB);
            }
            return Ok(());
        }
        let (moved_start_pos, corrected_offset_start) = if self.indexes.contains_key(&start_pos) {
            (start_pos + 1, min_offset)
        } else {
            (start_pos, min_offset - 1)
        };
        let (moved_end_pos, corrected_offset_end) = if self.indexes.contains_key(&end_pos) {
            (end_pos - 1, min_offset)
        } else {
            (end_pos, min_offset - 1)
        };
        let middle = (moved_end_pos - moved_start_pos) / 2 + moved_start_pos;
        if distance <= min_distance + 2 {
            self.insert_range(
                RangeInclusive::new(moved_start_pos, moved_end_pos),
                Nature::BREADCRUMB,
            );
        } else {
            self.insert_range(
                RangeInclusive::new(moved_start_pos, start_pos + corrected_offset_start),
                Nature::BREADCRUMB,
            );
            self.insert(&[middle], Nature::BREADCRUMB_SEPORATOR);
            self.insert_range(
                RangeInclusive::new(end_pos - corrected_offset_end, moved_end_pos),
                Nature::BREADCRUMB,
            );
        }
        Ok(())
    }

    pub fn breadcrumbs_build(
        &mut self,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), stypes::NativeError> {
        self.clean(Nature::BREADCRUMB);
        self.clean(Nature::BREADCRUMB_SEPORATOR);
        self.clean(Nature::EXPANDED);
        if self.stream_len == 0 || self.is_empty() {
            return Ok(());
        }
        let keys: Vec<u64> = self.keys.get();
        if keys.is_empty() {
            return Ok(());
        }
        let first_postion = *self.keys.first().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(String::from(
                "Keys vector is empty. Cannot extract first position",
            )),
        })?;
        self.breadcrumbs_insert_between(
            RangeInclusive::new(0, first_postion),
            min_distance,
            min_offset,
        )?;
        for pair in keys.windows(2) {
            let [from, to]: [u64; 2] = pair.try_into().unwrap();
            if from >= to {
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Grabber,
                    message: Some(format!("Map map is broken. Fail to compare previous and next elements. Prev: {from}; next: {to}",)),
                });
            }
            self.breadcrumbs_insert_between(
                RangeInclusive::new(from, to),
                min_distance,
                min_offset,
            )?;
        }
        let last_position = *self.keys.last().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(String::from(
                "Keys vector is empty. Cannot extract last position",
            )),
        })?;
        self.breadcrumbs_insert_between(
            RangeInclusive::new(last_position, self.stream_len - 1),
            min_distance,
            min_offset,
        )?;
        Ok(())
    }

    pub fn breadcrumbs_insert_and_update(
        &mut self,
        positions: &[u64],
        nature: Nature,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), stypes::NativeError> {
        if self.stream_len == 0 {
            return Ok(());
        }
        if nature.is_breadcrumb() || nature.is_seporator() {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(String::from("Cannot insert Nature::BREADCRUMB | Nature::BREADCRUMB_SEPORATOR to modify indexed map")),
            });
        }
        for position in positions.iter() {
            if let Some(index) = self.indexes.get_mut(position) {
                if index.is_seporator() {
                    self.index_remove(position, true);
                } else {
                    index.reassign(nature);
                    // Nothing todo because we didn't insert, but reassinged
                    continue;
                }
            }
            self.index_add(*position, nature);
            if let Some(before) = self.breadcrumbs_drop_before(*position)? {
                self.breadcrumbs_rebuild_between(before, *position, min_distance, min_offset)?;
            } else if *position > 0 {
                self.breadcrumbs_insert_between(
                    RangeInclusive::new(0, *position),
                    min_distance,
                    min_offset,
                )?;
            }
            if let Some(after) = self.breadcrumbs_drop_after(*position)? {
                self.breadcrumbs_rebuild_between(*position, after, min_distance, min_offset)?;
            } else if *position < (self.stream_len - 1) {
                self.breadcrumbs_insert_between(
                    RangeInclusive::new(*position, self.stream_len - 1),
                    min_distance,
                    min_offset,
                )?;
            }
        }
        Ok(())
    }

    pub fn breadcrumbs_drop_and_update(
        &mut self,
        positions: &[u64],
        nature: Nature,
    ) -> Result<(), stypes::NativeError> {
        if self.stream_len == 0 {
            return Ok(());
        }
        for position in positions.iter() {
            if let Some(index) = self.indexes.get_mut(position) {
                if !index.contains(&nature) {
                    return Err(stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::Grabber,
                        message: Some(format!("Index doesn't include target nature {nature:?}")),
                    });
                }
                if index.cross(Nature::BREADCRUMB.union(Nature::BREADCRUMB_SEPORATOR)) {
                    return Err(stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::Grabber,
                        message: Some(String::from("Cannot drop Nature::BREADCRUMB | Nature::BREADCRUMB_SEPORATOR | Nature::Search to modify indexed map")),
                    });
                }
                if !index.replace_if_empty(nature, Nature::BREADCRUMB) {
                    index.set_if_cross(Nature::EXPANDED, Nature::BREADCRUMB);
                }
            } else {
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Grabber,
                    message: Some(String::from("Fail to find Index for position {position}")),
                });
            }
        }
        Ok(())
    }

    fn breadcrumbs_rebuild_between(
        &mut self,
        from: u64,
        to: u64,
        min_distance: u64,
        min_offset: u64,
    ) -> Result<(), stypes::NativeError> {
        self.remove_if(from, Nature::BREADCRUMB);
        self.remove_if(to, Nature::BREADCRUMB);
        // If we already have breadcrumbs, which was expanded before by user, we don't need
        // to add new breadcrumbs. We should just shift seporator. To do it well we are
        // temporary removing such breadcrumbs and restore it at the end.
        let mut from_shifted = from;
        let mut expanded_before: Vec<u64> = vec![];
        for offset in 0..min_offset {
            if from < offset {
                break;
            }
            let pos = from - offset;
            if let Some((position, index)) = self.indexes.get_key_value(&pos) {
                if *index == Nature::BREADCRUMB.union(Nature::EXPANDED) {
                    expanded_before.push(*position);
                    from_shifted = *position;
                } else {
                    break;
                }
            }
        }
        let mut expanded_after: Vec<u64> = vec![];
        let mut to_shifted = to;
        for offset in 0..min_offset {
            if to + offset >= self.stream_len {
                break;
            }
            let pos = to + offset;
            if let Some((position, index)) = self.indexes.get_key_value(&pos) {
                if *index == Nature::BREADCRUMB.union(Nature::EXPANDED) {
                    expanded_after.push(*position);
                    to_shifted = *position;
                } else {
                    break;
                }
            }
        }
        let mut expanded = [expanded_before, expanded_after].concat();
        self.indexes_remove(&mut expanded);
        self.keys.sort();
        self.breadcrumbs_insert_between(
            RangeInclusive::new(from_shifted, to_shifted),
            min_distance,
            min_offset,
        )?;
        expanded.iter().for_each(|position| {
            if let Some(index) = self.indexes.get_mut(position) {
                index.include(Nature::EXPANDED);
            }
        });
        Ok(())
    }

    pub fn breadcrumbs_expand(
        &mut self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), stypes::NativeError> {
        let sep_index = self.indexes.get(&seporator).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(format!("Index {seporator} cannot be found.",)),
        })?;
        if !sep_index.is_seporator() {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Index {seporator} isn't Nature::BREADCRUMB_SEPORATOR.",
                )),
            });
        }
        let (before, after) = self.get_arround_positions(&seporator)?;
        if before.is_none() && after.is_none() {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Fail to find indexes around Nature::BREADCRUMB_SEPORATOR on {seporator}"
                )),
            });
        }
        self.remove(&[seporator], Nature::BREADCRUMB_SEPORATOR);
        if before.is_some() && after.is_some() {
            let before_pos = Option::unwrap(before);
            let after_pos = Option::unwrap(after);
            let (update_before, update_after) = if above {
                let updated = cmp::min(after_pos - 1, before_pos + offset);
                self.insert_range(
                    RangeInclusive::new(before_pos + 1, updated),
                    Nature::BREADCRUMB.union(Nature::EXPANDED),
                );
                (updated, after_pos)
            } else {
                let updated = cmp::max(before_pos + 1, after_pos.saturating_sub(offset));
                self.insert_range(
                    RangeInclusive::new(updated, after_pos - 1),
                    Nature::BREADCRUMB.union(Nature::EXPANDED),
                );
                (before_pos, updated)
            };
            if update_after <= update_before {
                // Some error during calculation
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Grabber,
                    message: Some(String::from("Error during calculation Nature::BREADCRUMB_SEPORATOR: position before grander position after")),
                });
            } else if update_after - update_before > 1 {
                // Seporator is still needed
                let middle = (update_after - update_before) / 2 + update_before;
                self.insert(&[middle], Nature::BREADCRUMB_SEPORATOR);
            }
        } else if before.is_some() && after.is_none() {
            let before_pos = Option::unwrap(before);
            let updated = cmp::min(seporator - 1, before_pos + offset);
            self.insert_range(
                RangeInclusive::new(before_pos + 1, updated),
                Nature::BREADCRUMB.union(Nature::EXPANDED),
            );
            if seporator <= updated {
                // Some error during calculation
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Grabber,
                    message: Some(String::from("Error during calculation Nature::BREADCRUMB_SEPORATOR: position before grander position after")),
                });
            } else if seporator - updated > 1 {
                // Seporator is still needed
                self.insert(&[seporator], Nature::BREADCRUMB_SEPORATOR);
            }
        } else {
            // before.is_none() && after.is_some()
            let after_pos = Option::unwrap(after);
            let updated = cmp::max(seporator + 1, after_pos.saturating_sub(offset));
            self.insert_range(
                RangeInclusive::new(updated, after_pos - 1),
                Nature::BREADCRUMB.union(Nature::EXPANDED),
            );
            if seporator <= updated {
                // Some error during calculation
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Grabber,
                    message: Some(String::from("Error during calculation Nature::BREADCRUMB_SEPORATOR: position before grander position after")),
                });
            } else if seporator - updated > 1 {
                // Seporator is still needed
                self.insert(&[seporator], Nature::BREADCRUMB_SEPORATOR);
            }
        }
        Ok(())
    }

    fn breadcrumbs_drop_before(&mut self, from: u64) -> Result<Option<u64>, stypes::NativeError> {
        let mut cursor: usize = self.keys.get_index(&from)?;
        let mut to_drop: Vec<u64> = vec![];
        let mut before: Option<u64> = None;
        loop {
            if cursor == 0 {
                break;
            }
            cursor -= 1;
            if let Some((i, index)) = self.indexes.get_key_value(&self.keys.get_position(cursor)?) {
                if !index.is_pinned() && !index.is_expanded() {
                    to_drop.push(*i);
                } else {
                    before = Some(*i);
                    break;
                }
            }
        }
        self.indexes_remove(&mut to_drop);
        Ok(before)
    }

    fn breadcrumbs_drop_after(&mut self, from: u64) -> Result<Option<u64>, stypes::NativeError> {
        let len = self.indexes.keys().len();
        let mut cursor: usize = self.keys.get_index(&from)?;
        let mut to_drop: Vec<u64> = vec![];
        let mut after: Option<u64> = None;
        loop {
            cursor += 1;
            if cursor >= len {
                break;
            }
            if let Some((i, index)) = self.indexes.get_key_value(&self.keys.get_position(cursor)?) {
                if !index.is_pinned() && !index.is_expanded() {
                    to_drop.push(*i);
                } else {
                    after = Some(*i);
                    break;
                }
            }
        }
        self.indexes_remove(&mut to_drop);
        Ok(after)
    }

    #[allow(clippy::type_complexity)]
    fn get_arround_positions(
        &mut self,
        position: &u64,
    ) -> Result<(Option<u64>, Option<u64>), stypes::NativeError> {
        let mut before: Option<u64> = None;
        let mut after: Option<u64> = None;
        let len = self.indexes.keys().len();
        let key_index = self.keys.get_index(position)?;
        if key_index > 0 {
            before = Some(self.keys.get_position(key_index - 1)?);
        }
        if key_index < len - 1 {
            after = Some(self.keys.get_position(key_index + 1)?);
        }
        Ok((before, after))
    }

    fn find_by_nature(
        &self,
        from_key_index: usize,
        filter: Nature,
        walk_down: bool,
    ) -> Result<Option<(&u64, &Nature)>, stypes::NativeError> {
        let len = self.indexes.keys().len();
        if from_key_index >= len {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Target from-key-index {from_key_index} is out of keys(); keys().len = {len}",
                )),
            });
        }
        let mut cursor = from_key_index;
        let mut result: Option<(&u64, &Nature)> = None;
        if walk_down {
            loop {
                if cursor >= len {
                    break;
                }
                if let Some((position, nature)) =
                    self.indexes.get_key_value(&self.keys.get_position(cursor)?)
                {
                    if filter.cross(*nature) {
                        result = Some((position, nature));
                        break;
                    }
                }
                cursor += 1;
            }
        } else {
            loop {
                if let Some((position, nature)) =
                    self.indexes.get_key_value(&self.keys.get_position(cursor)?)
                {
                    if filter.cross(*nature) {
                        result = Some((position, nature));
                        break;
                    }
                }
                if cursor == 0 {
                    break;
                }
                cursor -= 1;
            }
        }
        Ok(result)
    }

    pub fn clean(&mut self, nature: Nature) {
        let mut to_be_removed: Vec<u64> = vec![];
        self.indexes.iter_mut().for_each(|(position, index)| {
            index.exclude(nature);
            if index.is_empty() {
                to_be_removed.push(*position)
            }
        });
        self.indexes_remove(&mut to_be_removed);
    }

    pub fn len(&self) -> usize {
        self.indexes.len()
    }

    pub fn set_stream_len(
        &mut self,
        len: u64,
        min_distance: u64,
        min_offset: u64,
        update_breadcrumbs: bool,
    ) -> Result<(), stypes::NativeError> {
        self.stream_len = len;
        if self.stream_len == 0 {
            self.indexes.clear();
            self.keys.clear();
            return Ok(());
        }
        if update_breadcrumbs {
            let last_postion = *self.keys.last().ok_or(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(String::from(
                    "Keys vector is empty. Cannot extract last position",
                )),
            })?;
            if let Some(index) = self.indexes.get(&last_postion) {
                if index.is_pinned() {
                    self.breadcrumbs_insert_between(
                        RangeInclusive::new(last_postion, self.stream_len - 1),
                        min_distance,
                        min_offset,
                    )?;
                    return Ok(());
                }
                if let Some((position, _nature)) = self.find_by_nature(
                    self.indexes.keys().len() - 1,
                    Nature::SEARCH
                        .union(Nature::BOOKMARK)
                        .union(Nature::EXPANDED),
                    false,
                )? {
                    let from = *position;
                    let to = self.stream_len - 1;
                    self.remove_from(&from)?;
                    self.breadcrumbs_rebuild_between(from, to, min_distance, min_offset)?;
                }
            }
        }
        Ok(())
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn frame(&mut self, range: &mut RangeInclusive<u64>) -> Result<Frame, stypes::NativeError> {
        if range.end() >= &(self.indexes.len() as u64) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!(
                    "Out of range. Map len: {}; requested: {range:?}",
                    self.indexes.len()
                )),
            });
        }
        self.keys.sort();
        let mut frame = Frame::new();
        for index in range {
            let position = self.keys.get_position(index as usize)?;
            let nature = self.indexes.get(&position).ok_or(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("Cannot find nature for {position}")),
            })?;
            frame.insert((position, *nature));
        }
        Ok(frame)
    }
}

impl Default for Map {
    fn default() -> Self {
        Self::new()
    }
}

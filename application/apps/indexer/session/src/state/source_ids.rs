use serde::{Deserialize, Serialize};
use std::{collections::HashMap, ops::RangeInclusive};
pub struct MappedRanges<'a> {
    ranges: Vec<&'a (RangeInclusive<u64>, u8)>,
}

impl<'a> MappedRanges<'a> {
    pub fn new(ranges: Vec<&'a (RangeInclusive<u64>, u8)>) -> Self {
        Self { ranges }
    }

    pub fn source(&self, line: u64) -> Option<u8> {
        self.ranges.iter().find_map(|(range, source_id)| {
            if range.contains(&line) {
                Some(*source_id)
            } else {
                None
            }
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SourceDefinition {
    pub id: u8,
    pub alias: String,
}

#[derive(Debug)]
pub struct SourceIDs {
    pub sources: HashMap<u8, String>,
    pub map: Vec<(RangeInclusive<u64>, u8)>,
    pub recent: Option<u8>,
}

impl SourceIDs {
    pub fn new() -> Self {
        Self {
            sources: HashMap::new(),
            map: vec![],
            recent: None,
        }
    }

    pub fn add_source(&mut self, alias: String) -> u8 {
        let key = self.sources.len() as u8;
        self.sources.insert(key, alias);
        key
    }

    pub fn get_source(&mut self, alias: String) -> Option<u8> {
        self.sources
            .iter()
            .find_map(|(key, val)| if val == &alias { Some(*key) } else { None })
    }

    pub fn is_source_same(&self, source_id: u8) -> bool {
        if let Some(id) = self.recent {
            id == source_id
        } else {
            true
        }
    }

    pub fn source_update(&mut self, source_id: u8) {
        let changed = if let Some(id) = self.recent {
            id != source_id
        } else {
            false
        };
        if changed || self.recent.is_none() {
            self.recent = Some(source_id);
        }
    }

    pub fn get_recent_source_id(&self) -> u8 {
        if let Some(id) = self.recent {
            id
        } else {
            self.sources.len() as u8
        }
    }

    pub fn get_sources_definitions(&self) -> Vec<SourceDefinition> {
        self.sources
            .iter()
            .map(|(id, alias)| SourceDefinition {
                id: *id,
                alias: alias.to_string(),
            })
            .collect::<Vec<SourceDefinition>>()
    }

    pub fn add_range(&mut self, range: RangeInclusive<u64>, source_id: u8) {
        self.map.push((range, source_id));
    }

    pub fn get_mapped_ranges(&self, requested: &RangeInclusive<u64>) -> MappedRanges {
        MappedRanges::new(
            self.map
                .iter()
                .filter(|(range, _)| {
                    range.contains(requested.start())
                        || range.contains(requested.end())
                        || requested.contains(range.start())
                        || requested.contains(range.end())
                })
                .collect::<Vec<&(RangeInclusive<u64>, u8)>>(),
        )
    }
}

impl Default for SourceIDs {
    fn default() -> Self {
        Self::new()
    }
}

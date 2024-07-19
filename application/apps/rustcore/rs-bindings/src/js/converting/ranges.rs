use proto::*;
use std::{
    mem,
    ops::{Deref, RangeInclusive},
};
pub struct RangeInclusiveList(pub Vec<RangeInclusive<u64>>);

impl Deref for RangeInclusiveList {
    type Target = Vec<RangeInclusive<u64>>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<RangeInclusiveList> for Vec<u8> {
    fn from(mut val: RangeInclusiveList) -> Self {
        let els = mem::take(&mut val.0);
        let elements: Vec<common::RangeInclusive> = els
            .into_iter()
            .map(|el| common::RangeInclusive {
                start: *el.start(),
                end: *el.end(),
            })
            .collect();
        let list = common::RangeInclusiveList { elements };
        prost::Message::encode_to_vec(&list)
    }
}

#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;
use std::ops::RangeInclusive;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct Ranges(pub Vec<RangeInclusive<u64>>);

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct SourceDefinition {
    pub id: u16,
    pub alias: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct Sources(pub Vec<SourceDefinition>);

#[derive(Clone, Serialize, Deserialize, Debug)]
// #[serde(tag = "type", content = "value")]
#[extend::encode_decode]
pub enum SdeRequest {
    WriteText(String),
    WriteBytes(Vec<u8>),
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct SdeResponse {
    pub bytes: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[extend::encode_decode]
pub struct GrabbedElement {
    pub source_id: u16,
    pub content: String,
    pub pos: usize,
    pub nature: u8,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct GrabbedElementList(pub Vec<GrabbedElement>);

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct AroundIndexes(pub (Option<u64>, Option<u64>));

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct FilterMatch {
    pub index: u64,
    pub filters: Vec<u8>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct FilterMatchList(pub Vec<FilterMatch>);

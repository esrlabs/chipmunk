#[cfg(any(test, feature = "rustcore"))]
mod converting;
#[cfg(any(test, feature = "rustcore"))]
mod extending;
#[cfg(any(test, feature = "nodejs"))]
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
    #[serde(rename = "id")]
    pub source_id: u16,
    #[serde(rename = "c")]
    pub content: String,
    #[serde(rename = "p")]
    pub pos: usize,
    #[serde(rename = "n")]
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

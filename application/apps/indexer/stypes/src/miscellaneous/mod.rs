#[cfg(any(test, feature = "rustcore"))]
mod extending;

use crate::*;
use std::ops::RangeInclusive;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct Ranges(Vec<RangeInclusive<u64>>);

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct SourceDefinition {
    pub id: u16,
    pub alias: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct Sources(Vec<SourceDefinition>);

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
pub struct GrabbedElementList(Vec<GrabbedElement>);

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct AroundIndexes((Option<u64>, Option<u64>));

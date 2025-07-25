#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts", type = "Map<string, string>")
)]
pub struct MapKeyValue(pub HashMap<String, String>);

/// Representation of ranges. We cannot use std ranges as soon as no way
/// to derive Serialize, Deserialize
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct Range {
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    pub start: u64,
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    pub end: u64,
}

/// A list of ranges to read.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct Ranges(pub Vec<Range>);

/// Describes a data source.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct SourceDefinition {
    /// The unique identifier of the source.
    pub id: u16,
    /// Parent observe opeartion Uuid
    pub uuid: Uuid,
    /// The user-friendly name of the source for display purposes.
    pub descriptor: SessionDescriptor,
}

/// A list of data sources.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct Sources(pub Vec<SourceDefinition>);

/// A request to a stream that supports feedback, such as a terminal command
/// that accepts input through `stdin`.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub enum SdeRequest {
    /// Sends a text string.
    WriteText(String),
    /// Sends raw bytes.
    WriteBytes(Vec<u8>),
}

/// The response from a source to a sent `SdeRequest`. Note that sending data
/// with `SdeRequest` does not guarantee a response, as the behavior depends
/// on the source.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct SdeResponse {
    /// The number of bytes received.
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    pub bytes: usize,
}

/// Information about a log entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct GrabbedElement {
    /// The unique identifier of the source.
    pub source_id: u16,
    /// The textual content of the log entry.
    pub content: String,
    /// The position of the log entry in the overall stream.
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    pub pos: usize,
    /// The nature of the log entry, represented as a bitmask. Possible values include:
    /// - `SEARCH`: Nature = Nature(1)
    /// - `BOOKMARK`: Nature = Nature(1 << 1)
    /// - `EXPANDED`: Nature = Nature(1 << 5)
    /// - `BREADCRUMB`: Nature = Nature(1 << 6)
    /// - `BREADCRUMB_SEPARATOR`: Nature = Nature(1 << 7)
    pub nature: u8,
}

/// A list of log entries.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct GrabbedElementList(pub Vec<GrabbedElement>);

/// Data about indices (log entry numbers). Used to provide information about
/// the nearest search results relative to a specific log entry number.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    ts(type = "[number | undefined | null, number | undefined | null]")
)]
pub struct AroundIndexes(pub (Option<u64>, Option<u64>));

/// Describes a match for a search condition.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct FilterMatch {
    /// The index (number) of the matching log entry.
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "number"))]
    pub index: u64,
    /// The identifiers of the filters (search conditions) that matched
    /// the specified log entry.
    pub filters: Vec<u8>,
}

/// A list of matches for a search condition.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "miscellaneous.ts")
)]
pub struct FilterMatchList(pub Vec<FilterMatch>);

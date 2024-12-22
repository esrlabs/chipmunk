#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct NearestPosition {
    #[cfg_attr(test, ts(type = "number"))]
    pub index: u64, // Position in search results
    #[cfg_attr(test, ts(type = "number"))]
    pub position: u64, // Position in original stream/file
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct ResultNearestPosition(pub Option<NearestPosition>);

///(row_number, min_value_in_range, max_value_in_range, value)
/// value - can be last value in range or some kind of average
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct Point {
    #[cfg_attr(test, ts(type = "number"))]
    pub row: u64,
    pub min: f64,
    pub max: f64,
    pub y_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
#[cfg_attr(test, ts(type = "Map<number, Point[]>"))]
pub struct ResultSearchValues(pub HashMap<u8, Vec<Point>>);

/// Scaled chart data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct ResultScaledDistribution(pub Vec<Vec<(u8, u16)>>);

/// Used to delivery results of extracting values. That's used in the scope
/// of chart feature
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct ExtractedMatchValue {
    /// The index of log entry (row number)
    #[cfg_attr(test, ts(type = "number"))]
    pub index: u64,
    /// List of matches:
    /// `usize` - index of filter
    /// `Vec<String>` - list of extracted values
    pub values: Vec<(usize, Vec<String>)>,
}

/// The list of `ExtractedMatchValue`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct ResultExtractedMatchValues(pub Vec<ExtractedMatchValue>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
#[cfg_attr(test, ts(type = "number"))]
pub struct ResultU64(pub u64);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct ResultBool(pub bool);

/// Used only for debug session lifecycle
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "operations.ts"))]
pub struct ResultSleep {
    pub sleep_well: bool,
}

use serde::{Deserialize, Serialize};
use serde_json::Result;
use std::fs;

#[derive(Serialize, Deserialize, Debug)]
pub struct Chunk {
    pub r: (usize, usize),
    pub b: (usize, usize),
}
pub fn serialize_chunks(chunks: &Vec<Chunk>) -> Result<()> {
    // Serialize it to a JSON string.
    let j = serde_json::to_string(chunks)?;
    fs::write("lineMetadata.json", j).expect("Unable to write file");
    Ok(())
}

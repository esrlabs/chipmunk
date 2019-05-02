use serde::{Deserialize, Serialize};
use serde_json::Result;
use std::fs;

#[derive(Serialize, Deserialize)]
pub struct Chunk {
    pub line_range: (usize, usize),
    pub byte_range: (usize, usize),
}
pub fn serialize_chunks(chunks: &Vec<Chunk>) -> Result<()> {
    // Serialize it to a JSON string.
    let j = serde_json::to_string(chunks)?;
    println!("{}", j);
    fs::write("lineMetadata.json", j).expect("Unable to write file");
    Ok(())
}

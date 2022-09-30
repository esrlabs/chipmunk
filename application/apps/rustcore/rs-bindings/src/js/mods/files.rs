use blake3;
use node_bindgen::derive::node_bindgen;
use std::{
    fs::File,
    io::{self, prelude::*},
};

#[node_bindgen]
struct Files {}

#[node_bindgen]
impl Files {
    #[node_bindgen(constructor)]
    fn new() -> Self {
        Files {}
    }
    #[node_bindgen]
    async fn checksum(&self, filename: String) -> Result<String, String> {
        let mut file = File::open(&filename).map_err(|e| format!("{}", e))?;
        let mut hasher = blake3::Hasher::new();
        let mut buffer = [0; 65536];
        loop {
            match file.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    hasher.update(&buffer[..n]);
                }
                Err(ref e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(format!("{}", e)),
            }
        }
        Ok(hasher.finalize().to_string())
    }
}

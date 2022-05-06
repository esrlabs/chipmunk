use dlt_core::statistics::collect_dlt_stats;
use node_bindgen::derive::node_bindgen;
use std::path::Path;

#[node_bindgen]
struct Dlt {}

#[node_bindgen]
impl Dlt {
    #[node_bindgen(constructor)]
    fn new() -> Self {
        Dlt {}
    }
    #[node_bindgen]
    async fn stats(&self, file: String) -> Result<String, String> {
        match collect_dlt_stats(Path::new(&file)) {
            Ok(res) => serde_json::to_string(&res).map_err(|e| e.to_string()),
            Err(err) => Err(err.to_string()),
        }
    }
}

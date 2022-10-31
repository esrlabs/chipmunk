use dlt_core::statistics::{collect_dlt_stats, StatisticInfo};
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
    async fn stats(&self, files: Vec<String>) -> Result<String, String> {
        let mut stat = StatisticInfo::new();
        let mut error: Option<String> = None;
        files.iter().for_each(|file| {
            if error.is_some() {
                return;
            }
            match collect_dlt_stats(Path::new(&file)) {
                Ok(res) => {
                    stat.merge(res);
                }
                Err(err) => {
                    error = Some(err.to_string());
                }
            }
        });
        if let Some(err) = error {
            return Err(err);
        }
        serde_json::to_string(&stat).map_err(|e| e.to_string())
    }
}

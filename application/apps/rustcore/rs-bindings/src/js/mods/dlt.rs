use crate::{
    cancellation::Cancellation,
    js::converting::attachment::{FtOptions, WrappedAttachment},
};
use addon::{extract_dlt_ft, scan_dlt_ft};
use dlt_core::statistics::{collect_dlt_stats, StatisticInfo};
use node_bindgen::derive::node_bindgen;
use parsers::dlt::attachment::FileExtractor;
use std::path::Path;
use uuid::Uuid;

struct Dlt {
    cancellation: Cancellation,
}

#[node_bindgen]
impl Dlt {
    #[node_bindgen(constructor)]
    fn new() -> Self {
        Dlt {
            cancellation: Cancellation::new(),
        }
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
    #[node_bindgen]
    async fn scan<F: Fn(String) + Send + 'static>(
        &mut self,
        input: String,
        options: FtOptions,
        callback: F,
    ) -> Result<String, String> {
        let (uuid, cancel) = self.cancellation.create_token();
        callback(uuid.to_string());

        let result = scan_dlt_ft(
            Path::new(&input).to_path_buf(),
            options.filter_conf,
            options.with_storage_header,
            cancel,
        )
        .await;
        self.cancellation.remove_token(&uuid);

        match result {
            Ok(files) => serde_json::to_string(&files).map_err(|e| e.to_string()),
            Err(error) => Err(format!("failed to scan: {error}")),
        }
    }
    #[node_bindgen]
    async fn extract<F: Fn(String) + Send + 'static>(
        &mut self,
        input: String,
        output: String,
        files_with_names: Vec<(WrappedAttachment, String)>,
        callback: F,
    ) -> Result<String, String> {
        let (uuid, cancel) = self.cancellation.create_token();
        callback(uuid.to_string());

        let result = extract_dlt_ft(
            Path::new(&input),
            Path::new(&output),
            files_with_names
                .iter()
                .map(|f| (f.0.as_attachment(), f.1.clone()))
                .collect(),
            cancel,
        );
        self.cancellation.remove_token(&uuid);

        match result {
            Ok(size) => serde_json::to_string(&size).map_err(|e| e.to_string()),
            Err(error) => Err(format!("failed to extract: {error}")),
        }
    }
    #[node_bindgen]
    async fn extract_all<F: Fn(String) + Send + 'static>(
        &mut self,
        input: String,
        output: String,
        options: FtOptions,
        callback: F,
    ) -> Result<String, String> {
        let (uuid, cancel) = self.cancellation.create_token();
        callback(uuid.to_string());

        match scan_dlt_ft(
            Path::new(&input).to_path_buf(),
            options.filter_conf,
            options.with_storage_header,
            cancel.clone(),
        )
        .await
        {
            Ok(files) => {
                let result = extract_dlt_ft(
                    Path::new(&input),
                    Path::new(&output),
                    FileExtractor::files_with_names_prefixed(files),
                    cancel,
                );
                self.cancellation.remove_token(&uuid);
                match result {
                    Ok(size) => serde_json::to_string(&size).map_err(|e| e.to_string()),
                    Err(error) => Err(format!("failed to extract: {error}")),
                }
            }
            Err(error) => {
                self.cancellation.remove_token(&uuid);
                Err(format!("failed to scan: {error}"))
            }
        }
    }
    #[node_bindgen]
    async fn cancel_operation(&mut self, uuid_str: String) -> Result<(), String> {
        if let Ok(uuid) = Uuid::parse_str(&uuid_str) {
            self.cancellation.cancel(&uuid);
        }
        Ok(())
    }
}

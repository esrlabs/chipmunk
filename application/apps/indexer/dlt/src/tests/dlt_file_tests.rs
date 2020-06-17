#[cfg(test)]
mod tests {

    use crate::dlt_file::*;
    use crossbeam_channel as cc;
    use indexer_base::{chunks::ChunkResults, config::IndexingConfig};
    use std::path::PathBuf;
    #[test]
    fn test_storage_header_illegeal() {
        let in_path = PathBuf::from("..")
            .join("dlt/test_samples")
            .join("lukas_crash.dlt");
        let out_path = PathBuf::from("..")
            .join("dlt/test_samples")
            .join("lukas_crash.dlt.out");

        let source_file_size = std::fs::metadata(&in_path).unwrap().len();
        let (tx, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
        let chunk_size = 500usize;
        let tag_string = "TAG".to_string();
        let _res = create_index_and_mapping_dlt(
            IndexingConfig {
                tag: tag_string,
                chunk_size,
                in_file: in_path,
                out_path,
                append: false,
                watch: false,
            },
            source_file_size,
            None,
            &tx,
            None,
            None,
        );
    }
}

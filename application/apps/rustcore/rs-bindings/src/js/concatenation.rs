use crate::js::events::ComputationError;
use crossbeam_channel as cc;
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults},
    progress::{IndexingProgress, ProgressReporter},
    utils,
};
use merging::concatenator::{concat_files, ConcatenatorInput};
use node_bindgen::derive::node_bindgen;
use std::path::PathBuf;

/// add two integer
#[node_bindgen]
fn concatenate_files(input: String, out: String, append: bool) -> Result<(), ComputationError> {
    let concat_inputs: Vec<ConcatenatorInput> = serde_json::from_str(&input)?;
    let chunk_size = 500usize;
    let out_path = PathBuf::from(out);
    let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
    concat_files(
        concat_inputs, //: Vec<ConcatenatorInput>,
        &out_path,     //&Path,
        append,        //bool,
        chunk_size,    //usize, // used for mapping line numbers to byte positions
        tx,
        None,
    );
    Ok(())
}

// use crate::js::events::*;
// // use crate::js::session::OperationAction;
// use crossbeam_channel as cc;
// use indexer_base::progress::Notification;
// use indexer_base::progress::{IndexingProgress, IndexingResults, Severity};
// use neon::prelude::*;
// use std::fs::File;
// use std::io::BufWriter;
// use std::path::Path;
// use std::path::PathBuf;

// pub struct SearchAction {
//     pub handler: Option<EventHandler>,
//     pub shutdown_channel: Channel<()>,
//     pub event_channel: Channel<IndexingResults<()>>,
//     pub input_path: PathBuf,
//     pub output_path: PathBuf,
//     pub regex: String,
// }

// impl SearchAction {
//     pub fn new(
//         input: &Path,
//         regex: &str,
//         shutdown_channel: Channel<()>,
//         event_channel: Channel<IndexingResults<()>>,
//     ) -> Result<Self, ComputationError> {
//         Ok(Self {
//             handler: None,
//             shutdown_channel,
//             event_channel,
//             input_path: PathBuf::from(input),
//             output_path: PathBuf::from(format!("{}.out", input.to_string_lossy())),
//             regex: regex.to_owned(),
//         })
//     }
// }
// impl SearchAction {
//     fn is_search(&self) -> bool {
//         true
//     }

//     fn prepare(
//         &self,
//         result_sender: cc::Sender<IndexingResults<()>>,
//         _shutdown_rx: Option<ShutdownReceiver>,
//     ) -> Result<(), ComputationError> {
//         let search_holder = search::SearchHolder {
//             file_path: self.input_path.clone(),
//             out_file_path: self.output_path.clone(),
//         };
//         let result = match search_holder.search(self.regex.clone()) {
//             Ok(out) => {
//                 println!("RUST: search completed, result file: {:?}", out);
//                 Ok(())
//             }
//             Err(e) => {
//                 println!("Error during search: {}", e);
//                 let error_text = "Could not complete search".to_string();

//                 let _ = result_sender.send(Err(Notification {
//                     severity: Severity::ERROR,
//                     content: error_text.clone(),
//                     line: None,
//                 }));
//                 Err(ComputationError::Communication(error_text))
//             }
//         };
//         let _ = result_sender.send(Ok(IndexingProgress::Finished));
//         result
//     }
// }

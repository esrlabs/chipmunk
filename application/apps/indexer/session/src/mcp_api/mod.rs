// MCP API for handling communication between the Chipmunk application and the MCP client/server.
// Contains functinality to:
// - create and manage MCP API instances
// - run the MCP event loop to process incoming messages
// - methods to send messages to the MCP client and server

use log::{error, warn};
use tokio::select;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

use crate::operations::{Operation, OperationKind};
use crate::state::SessionStateAPI;
use mcp::errors::McpError;
use mcp::server::tasks::Tasks;
use mcp::types::{Prompt, Response};
use processor::search::filter::SearchFilter;

#[derive(Debug, Clone)]
pub struct McpApi {
    pub prompt_tx: mpsc::Sender<Prompt>,
    pub state_api: SessionStateAPI,
}

impl McpApi {
    pub fn new(prompt_tx: mpsc::Sender<Prompt>, state_api: SessionStateAPI) -> Self {
        Self {
            prompt_tx,
            state_api,
        }
    }

    /// TODO:[MCP] Send a prompt to the Chipmunk MCP client. The prompt would typically come from the UI.
    /// The arguments probably need to be tweaked to also include the session
    pub async fn send_prompt(&self, prompt: String) -> Result<(), stypes::NativeError> {
        warn!("✅ Sending prompt to the client over `prompt_tx` channel");
        let mut final_prompt = prompt.clone();
        match self.state_api.get_stream_len().await {
            Ok((len, _)) => {
                let count = std::cmp::min(len, 20);
                if count > 0 {
                    let ranges = vec![0..=(count - 1)];
                    match self.state_api.grab_ranges(ranges).await {
                        Ok(elements) => {
                            let logs = elements
                                .into_iter()
                                .map(|e| e.content)
                                .collect::<Vec<_>>()
                                .join("\n");
                            final_prompt = format!(
                                "{}\n\nHere are the first {} log lines from the current session to help you understand the format and content:\n```\n{}\n```",
                                prompt, count, logs
                            );
                        }
                        Err(err) => {
                            error!("Failed to grab log lines: {:?}", err);
                        }
                    }
                }
            }
            Err(err) => {
                error!("Failed to get stream length: {:?}", err);
            }
        };
        self.prompt_tx
            .send(final_prompt)
            .await
            .map_err(|_| stypes::NativeError::channel(&format!("Failed to get send::{:?}", prompt)))
    }
}

pub async fn run(
    session_uuid: Uuid,
    mut task_rx: tokio::sync::mpsc::Receiver<Tasks>,
    mut _response_rx: tokio::sync::mpsc::Receiver<Response>,
    tx_operations: UnboundedSender<Operation>,
) {
    loop {
        select! {
            Some(server_request) = task_rx.recv() => {
                match server_request {
                    Tasks::ApplySearchFilter {filters, task_result_tx} => {
                        let filters = filters.iter().map(|f| SearchFilter::new(f.value.clone(), f.is_regex, f.ignore_case, f.is_word)).collect();

                        let operation = Operation::new(
                            session_uuid,
                            OperationKind::Search { filters },
                        );

                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution {message: err.to_string(),}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::DropSearch { task_result_tx } => {
                        let operation = Operation::new(session_uuid, OperationKind::Search { filters: vec![] });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::SearchValues { filters, task_result_tx } => {
                        let operation = Operation::new(session_uuid, OperationKind::SearchValues { filters });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::ExtractMatches { filters, task_result_tx } => {
                        let filters = filters.iter().map(|f| SearchFilter::new(
                            f.value.clone(), f.is_regex, f.ignore_case, f.is_word
                        )).collect();
                        let operation = Operation::new(session_uuid, OperationKind::Extract { filters });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::GetChartHistogram { dataset_len, range, task_result_tx } => {
                        let operation = Operation::new(session_uuid, OperationKind::Map { dataset_len, range });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::GetChartLinePlots { dataset_len, range, task_result_tx } => {
                        let range = range.map(|r| r.0..=r.1);
                        let operation = Operation::new(session_uuid, OperationKind::Values { dataset_len, range });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::Export { out_path, ranges, columns, spliter, delimiter, task_result_tx } => {
                        let ranges = ranges.into_iter().map(|r| r.0..=r.1).collect();
                        let operation = Operation::new(session_uuid, OperationKind::Export {
                            out_path: out_path.into(), ranges, columns, spliter, delimiter
                        });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::ExportRaw { out_path, ranges, task_result_tx } => {
                        let ranges = ranges.into_iter().map(|r| r.0..=r.1).collect();
                        let operation = Operation::new(session_uuid, OperationKind::ExportRaw {
                            out_path: out_path.into(), ranges
                        });
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    Tasks::GetNearestPosition { position_in_stream, task_result_tx } => {
                        let operation = Operation::new(session_uuid, OperationKind::GetNearestPosition(position_in_stream));
                        if let Err(err) = tx_operations.send(operation) {
                            let _ = task_result_tx.send(Err(McpError::ToolExecution { message: err.to_string()}));
                        } else {
                            let _ = task_result_tx.send(Ok(()));
                        }
                    },
                    _ => {
                        warn!("Yet to be implemented");
                    }
                }
            }
            else => break
        }
    }
}

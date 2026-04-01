use std::ops::ControlFlow;

use itertools::Itertools;
use tokio::{
    select,
    sync::{broadcast, mpsc},
};
use uuid::Uuid;

use mcp::{
    chat::Prompt, client::McpClient, errors::McpError, server::tasks::Tasks, tool_params::LogLine,
    types::TaskResult,
};
use processor::grabber::LineRange;
use session_core::session::Session;
use stypes::{CallbackEvent, ComputationError, ObserveOptions, ObserveOrigin, Transport};

use super::{command::SessionCommand, communication::ServiceHandle, error::SessionError};
use crate::{
    host::{
        message::HostMessage,
        notification::AppNotification,
        service::file::get_file_format,
        ui::{
            home::state::SessionConfig,
            session_setup::state::{
                SessionSetupState,
                parsers::ParserConfig,
                sources::{ByteSourceConfig, StreamConfig},
            },
        },
    },
    session::{
        InitSessionError, InitSessionParams,
        command::AttachSource,
        communication::{self, ServiceSenders, SharedSenders},
        message::SessionMessage,
        types::{ObserveOperation, OperationPhase},
        ui::{SessionInfo, chart::ChartBar},
    },
};

#[derive(Debug)]
pub struct SessionService {
    cmd_rx: mpsc::Receiver<SessionCommand>,
    senders: ServiceSenders,
    session: Session,
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
    mcp_task_rx: broadcast::Receiver<Tasks>,
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub async fn spawn(
        shared_senders: SharedSenders,
        options: ObserveOptions,
    ) -> Result<InitSessionParams, InitSessionError> {
        let mcp_task_rx = shared_senders.get_mcp_task_subscriber();

        let session_id = Uuid::new_v4();

        let (ui_handle, service_handle) = communication::init(shared_senders);

        let (session, callback_rx) = session_core::session::Session::new(session_id).await?;

        let session_info = SessionInfo::from_observe_options(session_id, &options);
        let session_config = SessionConfig::from_observe_options(&options);

        let observe_id = Uuid::new_v4();
        let observe_op = ObserveOperation::new(observe_id, options.origin.clone());

        session.observe(observe_id, options)?;

        let ServiceHandle { cmd_rx, senders } = service_handle;

        let service = Self {
            cmd_rx,
            senders,
            session,
            callback_rx,
            mcp_task_rx,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        let info = InitSessionParams {
            session_info,
            session_config,
            communication: ui_handle,
            observe_op,
        };

        Ok(info)
    }

    #[inline]
    pub fn session_id(&self) -> Uuid {
        self.session.get_uuid()
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id());

        let (client, prompt_tx, mut response_rx) = McpClient::new();
        if let Err(err) = client.start().await {
            log::error!(
                "Failed to start MCP client for session {}: {err:?}",
                self.session_id()
            );
        }
        loop {
            select! {
                Some(cmd) = self.cmd_rx.recv() => {
                    match self.handle_command(cmd, prompt_tx.clone()).await {
                        Ok(ControlFlow::Break(())) => break,
                        Ok(ControlFlow::Continue(())) => {},
                        Err(error) => {
                            log::error!("Error while handling session commands: {error:?}");
                            self.send_error(error).await;
                        }
                    }
                },

                Ok(task) = self.mcp_task_rx.recv() => {
                    self.handle_mcp_task(task).await;
                },

                Some(response) = response_rx.recv() => {
                    log::trace!("Received response from MCP client for session {}: {response:?}", self.session_id());
                    self.senders.send_session_msg(SessionMessage::ChatResponseReceived(response)).await;
                },

                // Callback receiver won't be dropped when session is dropped.
                Some(event) = self.callback_rx.recv() => {
                    if let Err(error)= self.handle_callbacks(event).await {
                        log::error!("Error while handling session callback event: {error:?}");
                        self.send_error(error).await;
                    }
                },
                else => { break; }
            }
        }

        log::trace!("Session Service {} has been dropped", self.session_id());

        //TODO AAZ: Keep this to make sure that session are dropped.
        println!(
            "****** DEBUG: Session Service {} has been dropped",
            self.session_id()
        );
    }

    async fn send_error(&self, error: SessionError) {
        let notifi = AppNotification::SessionError {
            session_id: self.session_id(),
            error,
        };

        self.senders.send_notification(notifi).await;
    }

    async fn handle_mcp_task(&self, task: Tasks) {
        match task {
            Tasks::AnalyzeLogFile {
                session_id,
                range,
                action,
                filters,
                jump_to_line,
                note,
                task_result_tx,
            } => {
                // Log the task details
                println!(
                    "Processing AnalyzeLogFile task for session {}: range={:?}, action={:?}, note={:?}",
                    session_id, range, action, note
                );

                // Build task result
                let result = self
                    .process_analyze_log_task(
                        range.clone(),
                        action.clone(),
                        filters.clone(),
                        jump_to_line,
                    )
                    .await;

                // Still send message to UI for visibility
                let message = SessionMessage::MCPTaskReceived(Tasks::AnalyzeLogFile {
                    session_id,
                    range,
                    action,
                    filters,
                    jump_to_line,
                    note,
                    task_result_tx: task_result_tx.clone(),
                });
                self.senders.send_session_msg(message).await;

                // Send result back to MCP server
                if let Err(e) = task_result_tx.send(result).await {
                    log::error!("Failed to send analyze_log task result back to MCP server: {e:?}");
                }
            }
            Tasks::ApplySearchFilter {
                session_id,
                filters,
                task_result_tx,
            } => {
                log::debug!(
                    "Processing ApplySearchFilter task for session {}",
                    session_id
                );
                let message = SessionMessage::MCPTaskReceived(Tasks::ApplySearchFilter {
                    session_id,
                    filters: filters.clone(),
                    task_result_tx: task_result_tx.clone(),
                });
                self.senders.send_session_msg(message).await;
            }
            Tasks::GetChartHistogram {
                session_id,
                dataset_len,
                range,
                task_result_tx,
            } => {
                log::debug!(
                    "Processing GetChartHistogram task for session {}",
                    session_id
                );
                // Chart data retrieval
                let result = self
                    .session
                    .state
                    .get_scaled_map(dataset_len, range.map(|r| (*r.start(), *r.end())))
                    .await
                    .map(|_| TaskResult::Complete("Chart data retrieved".to_string()))
                    .map_err(|e| McpError::TaskExecutionFailed(format!("{:?}", e)));

                let _ = task_result_tx.send(result);
            }
            Tasks::GetChartLinePlots {
                session_id,
                dataset_len,
                range,
                task_result_tx,
            } => {
                log::debug!(
                    "Processing GetChartLinePlots task for session {}",
                    session_id
                );
                // Line plot data retrieval
                let result = self
                    .session
                    .state
                    .get_search_values(range, dataset_len)
                    .await
                    .map(|_| TaskResult::Complete("Line plot data retrieved".to_string()))
                    .map_err(|e| McpError::TaskExecutionFailed(format!("{:?}", e)));

                let _ = task_result_tx.send(result);
            }
            Tasks::GenericTask {
                session_id,
                task_result_tx,
            } => {
                log::debug!("Processing GenericTask for session {}", session_id);
                let result = Ok(TaskResult::Complete("Generic task completed".to_string()));
                let _ = task_result_tx.send(result);
            }
            Tasks::GrabLines {
                session_id,
                range,
                task_result_tx,
            } => {
                if self.session_id() == session_id {
                    let mut lines: Vec<String> = vec![];
                    if let Ok(result) = self
                        .session
                        .grab(processor::grabber::GrabRange::from(range))
                        .await
                        .map(|e| e.0)
                        .map_err(SessionError::from)
                    {
                        result
                            .into_iter()
                            .for_each(|element| lines.push(element.content));
                    }

                    if let Err(err) = task_result_tx
                        .send(Ok(TaskResult::RequestLines(lines)))
                        .await
                    {
                        log::error!("Error while sending the result back: {err}");
                    }
                }
            }
            Tasks::CompleteChat {
                session_id,
                final_result,
                task_result_tx,
            } => {
                if self.session_id() == session_id {
                    if let Err(err) = task_result_tx
                        .send(Ok(TaskResult::Complete(final_result)))
                        .await
                    {
                        log::error!("Error while sending the result back: {err}");
                    }
                }
            }
        }
    }

    async fn process_analyze_log_task(
        &self,
        range: Option<std::ops::RangeInclusive<u64>>,
        action: mcp::tool_params::AnalyzeAction,
        filters: Vec<processor::search::filter::SearchFilter>,
        jump_to_line: Option<u64>,
    ) -> Result<TaskResult, McpError> {
        use mcp::tool_params::{AnalyzeAction, AnalyzeLogsResult};

        // Grab lines if range is provided
        let lines = if let Some(ref range) = range {
            let line_range = LineRange::from(range.clone());
            match self.session.grab(line_range).await {
                Ok(grabbed_elements) => grabbed_elements
                    .0
                    .into_iter()
                    .map(|elem| LogLine {
                        source_id: elem.source_id,
                        pos: elem.pos as u64,
                        nature: elem.nature,
                        content: elem.content,
                    })
                    .collect(),
                Err(e) => {
                    return Err(McpError::TaskExecutionFailed(format!(
                        "Failed to grab lines: {:?}",
                        e
                    )));
                }
            }
        } else {
            Vec::new()
        };

        // Handle action if provided
        let action_status = match action {
            AnalyzeAction::ApplyFilter => {
                if !filters.is_empty() {
                    match self
                        .session
                        .apply_search_filters(Uuid::new_v4(), filters.clone())
                    {
                        Ok(_) => Some(format!("Applied {} filter(s)", filters.len())),
                        Err(e) => {
                            return Err(McpError::TaskExecutionFailed(format!(
                                "Failed to apply filters: {:?}",
                                e
                            )));
                        }
                    }
                } else {
                    Some("No filters to apply".to_string())
                }
            }
            AnalyzeAction::JumpToLine => {
                if let Some(line) = jump_to_line {
                    Some(format!("Jumped to line {}", line))
                } else {
                    Some("No line specified for jump".to_string())
                }
            }
            AnalyzeAction::None => None,
        };

        Ok(TaskResult::AnalyzeLogs(AnalyzeLogsResult {
            requested_range: range,
            lines,
            action_status,
            note: None,
        }))
    }

    async fn handle_command(
        &mut self,
        cmd: SessionCommand,
        prompt_tx: mpsc::Sender<Prompt>,
    ) -> Result<ControlFlow<(), ()>, SessionError> {
        match cmd {
            SessionCommand::GrabLinesBlocking { range, sender } => {
                let elements = self
                    .session
                    .grab(range)
                    .await
                    .map(|e| e.0)
                    .map_err(SessionError::from);

                if sender.send(elements).is_err() {
                    log::debug!("Grabbed lines receiver dropped before receiving the results.");
                }
            }
            SessionCommand::GrabIndexedLinesBlocking { range, sender } => {
                let elements = self
                    .session
                    .grab_indexed(range.clone())
                    .await
                    .map(|e| e.0)
                    .map_err(SessionError::from);

                if sender.send(elements).is_err() {
                    log::debug!(
                        "Grabbed indexed lines receiver dropped before receiving the results."
                    );
                }
            }
            SessionCommand::ApplySearchFilter {
                operation_id,
                filters,
            } => {
                self.session.apply_search_filters(operation_id, filters)?;
            }
            SessionCommand::DropSearch { operation_id } => {
                if let Some(filter_op) = operation_id {
                    self.session.abort(Uuid::new_v4(), filter_op)?;
                }
                self.session.drop_search().await?;
            }
            SessionCommand::ApplySearchValuesFilter {
                operation_id,
                filters,
            } => {
                self.session
                    .apply_search_values_filters(operation_id, filters)?;
            }
            SessionCommand::DropSearchValues { operation_id } => {
                if let Some(values_op) = operation_id {
                    self.session.abort(Uuid::new_v4(), values_op)?;
                }
                self.session
                    .state
                    .drop_search_values()
                    .await
                    .map_err(SessionError::NativeError)?;
            }
            SessionCommand::GetNearestPosition(position) => {
                let nearest = self
                    .session
                    .state
                    .get_nearest_position(position)
                    .await
                    .map_err(SessionError::NativeError)
                    .map(|n| n.0);

                log::trace!(
                    "Nearest session value for session: {}: {nearest:?}",
                    self.session_id()
                );

                self.senders
                    .send_session_msg(SessionMessage::NearestPosition(nearest))
                    .await;
            }
            SessionCommand::GetSelectedLog(pos) => {
                let rng = LineRange::from(pos..=pos);

                let selected_log = self
                    .session
                    .grab(rng)
                    .await
                    .and_then(|items| {
                        items.0.into_iter().next().ok_or_else(|| {
                            ComputationError::Process(String::from(
                                "Selected Item couldn't be fetched",
                            ))
                        })
                    })
                    .map_err(SessionError::from);

                self.senders
                    .send_session_msg(SessionMessage::SelectedLog(selected_log))
                    .await;
            }
            SessionCommand::AddBookmark(row) => {
                self.session.add_bookmark(row).await?;
                self.senders
                    .send_session_msg(SessionMessage::BookmarkUpdated {
                        row,
                        is_bookmarked: true,
                    })
                    .await;
            }
            SessionCommand::RemoveBookmark(row) => {
                self.session.remove_bookmark(row).await?;
                self.senders
                    .send_session_msg(SessionMessage::BookmarkUpdated {
                        row,
                        is_bookmarked: false,
                    })
                    .await;
            }
            SessionCommand::GetChartHistogram { dataset_len, range } => {
                let map = self
                    .session
                    .state
                    .get_scaled_map(dataset_len, range.map(|rng| (*rng.start(), *rng.end())))
                    .await
                    .map(|m| {
                        m.into_iter()
                            .map(|bars| {
                                bars.into_iter()
                                    .map(|(idx, count)| ChartBar::new(idx, count))
                                    .collect_vec()
                            })
                            .collect_vec()
                    })
                    .map_err(SessionError::NativeError);

                self.senders
                    .send_session_msg(SessionMessage::ChartHistogram(map))
                    .await;
            }
            SessionCommand::GetChartLinePlots { dataset_len, range } => {
                let values = self
                    .session
                    .state
                    .get_search_values(range, dataset_len)
                    .await
                    .map(|v| {
                        v.into_iter()
                            .map(|item| {
                                (
                                    item.0,
                                    item.1.into_iter().map(stypes::Point::from).collect_vec(),
                                )
                            })
                            .collect_vec()
                    })
                    .map_err(SessionError::NativeError);

                self.senders
                    .send_session_msg(SessionMessage::ChartLinePlots(values))
                    .await;
            }
            SessionCommand::AttachSource { source } => {
                let executed = self
                    .session
                    .state
                    .get_executed_holder()
                    .await
                    .map_err(SessionError::NativeError)?;

                let Some(parser) = executed.executed.first().map(|opt| opt.parser.to_owned())
                else {
                    if cfg!(debug_assertions) {
                        panic!("No executed operatoins");
                    }
                    return Ok(ControlFlow::Continue(()));
                };

                let origin = match source {
                    AttachSource::Files(paths) => {
                        let files = paths
                            .into_iter()
                            .map(|path| {
                                (
                                    Uuid::new_v4().to_string(),
                                    get_file_format(&path).unwrap_or(stypes::FileFormat::Text),
                                    path,
                                )
                            })
                            .collect_vec();
                        ObserveOrigin::Concat(files)
                    }
                    AttachSource::Stream(config) => {
                        let id = Uuid::new_v4().to_string();
                        let transport = match *config {
                            StreamConfig::Process(process) => Transport::Process(process.into()),
                            StreamConfig::Tcp(tcp) => Transport::TCP(tcp.into()),
                            StreamConfig::Udp(udp) => Transport::UDP(udp.into()),
                            StreamConfig::Serial(serial) => Transport::Serial(serial.into()),
                        };

                        ObserveOrigin::Stream(id, transport)
                    }
                };
                let observe_id = Uuid::new_v4();
                let observe_op = ObserveOperation::new(observe_id, origin.clone());

                self.session
                    .observe(observe_id, ObserveOptions { origin, parser })?;

                self.senders
                    .send_session_msg(SessionMessage::SourceAdded {
                        observe_op: Box::new(observe_op),
                    })
                    .await;
            }
            SessionCommand::StartSessionWithSource { source_uuid } => {
                let observed = self
                    .session
                    .state
                    .get_executed_holder()
                    .await
                    .map_err(SessionError::NativeError)?
                    .executed;

                for options in observed {
                    let source = match &options.origin {
                        ObserveOrigin::File(uuid, file_format, path_buf) => (uuid == &source_uuid)
                            .then(|| {
                                ByteSourceConfig::from_file(path_buf.to_owned(), *file_format)
                            }),
                        ObserveOrigin::Concat(items) => items
                            .iter()
                            .find(|(uuid, _, _)| uuid == &source_uuid)
                            .map(|(_, format, path)| {
                                ByteSourceConfig::from_file(path.to_owned(), *format)
                            }),
                        ObserveOrigin::Stream(uuid, transport) => (uuid == &source_uuid)
                            .then(|| ByteSourceConfig::from_transport(transport)),
                    };

                    let Some(source) = source else {
                        continue;
                    };

                    let parser = ParserConfig::from_observe_options(&options);

                    let session_setup = SessionSetupState::new(Uuid::new_v4(), source, parser);

                    self.senders
                        .send_host_message(HostMessage::SessionSetupOpened(Box::new(session_setup)))
                        .await;
                    return Ok(ControlFlow::Continue(()));
                }

                return Err(ComputationError::SessionCreatingFail.into());
            }
            SessionCommand::CancelOperation { id } => {
                self.session.abort(Uuid::new_v4(), id)?;
            }
            SessionCommand::SendChatMessage {
                id,
                message,
                history: _,
                ai_config,
            } => {
                if let Err(err) = prompt_tx
                    .send(Prompt {
                        id,
                        message: message.clone(),
                        config: ai_config.clone(),
                    })
                    .await
                {
                    log::error!("Failed to send chat message to MCP client: {err:?}");
                }
            }
            SessionCommand::CloseSession => {
                // Session UI can be already dropped at this point, therefore
                // we don't need to send errors to UI in this case.

                if let Err(err) = self.session.stop(Uuid::new_v4()).await {
                    log::error!("Stopping session failed. {err:?}");
                }

                return Ok(ControlFlow::Break(()));
            }
        }

        Ok(ControlFlow::Continue(()))
    }

    async fn handle_callbacks(&mut self, event: CallbackEvent) -> Result<(), SessionError> {
        log::trace!(
            "Received callback. Session: {}. Event: {}",
            self.session_id(),
            event
        );
        match event {
            CallbackEvent::StreamUpdated(logs_count) => {
                self.senders
                    .send_session_msg(SessionMessage::LogsCount(logs_count))
                    .await;
            }
            CallbackEvent::SearchUpdated { found, stat: _ } => {
                self.senders
                    .send_session_msg(SessionMessage::SearchResultCountUpdated { count: found })
                    .await;
            }
            CallbackEvent::IndexedMapUpdated { len } => {
                self.senders
                    .send_session_msg(SessionMessage::IndexedCountUpdated { count: len })
                    .await;
            }
            CallbackEvent::SearchMapUpdated(filter_matches) => match filter_matches {
                Some(list) => {
                    self.senders
                        .send_session_msg(SessionMessage::SearchResults(list.0))
                        .await;
                }
                None => {
                    self.senders
                        .send_session_msg(SessionMessage::SearchResultsCleared)
                        .await;
                }
            },
            CallbackEvent::SearchValuesUpdated(values_matches) => {
                self.senders
                    .send_session_msg(SessionMessage::ChartSearchValues(values_matches))
                    .await;
            }
            CallbackEvent::OperationError { uuid, error } => {
                // Stop running operation on errors besides sending the notification.
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: uuid,
                        phase: OperationPhase::Done,
                    })
                    .await;
                self.send_error(SessionError::NativeError(error)).await;
            }
            CallbackEvent::OperationStarted(uuid) => {
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: uuid,
                        phase: OperationPhase::Initializing,
                    })
                    .await;
            }
            CallbackEvent::OperationProcessing(uuid) => {
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: uuid,
                        phase: OperationPhase::Processing,
                    })
                    .await;
            }
            CallbackEvent::OperationDone(done) => {
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: done.uuid,
                        phase: OperationPhase::Done,
                    })
                    .await;
            }
            CallbackEvent::FileRead => {
                self.senders
                    .send_session_msg(SessionMessage::FileReadCompleted)
                    .await;
            }
            event => {
                println!("************** DEBUG: Received unhandled callback: {event:?}");
                log::warn!("Unhandled callback: {event}");
            }
        }

        Ok(())
    }
}

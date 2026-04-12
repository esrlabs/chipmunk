use std::{ops::ControlFlow, sync::Arc};

use itertools::Itertools;
use tokio::{select, sync::mpsc};
use uuid::Uuid;

use processor::grabber::LineRange;
use session_core::session::Session;
use stypes::{CallbackEvent, ComputationError, ObserveOptions, ObserveOrigin, Transport};

use super::{command::SessionCommand, communication::ServiceHandle, error::SessionError};
use crate::{
    common::time::unix_timestamp_now,
    host::{
        message::HostMessage,
        notification::AppNotification,
        service::file::get_file_format,
        ui::{
            session_setup::state::{
                SessionSetupState,
                parsers::ParserConfig,
                sources::{ByteSourceConfig, StreamConfig},
            },
            storage::{
                RecentSessionRegistration, RecentSessionStateSnapshot, RecentSourceSnapshot,
            },
        },
    },
    session::{
        InitSessionError, InitSessionParams, SpawnedSession,
        command::AttachSource,
        communication::{self, ServiceSenders, SharedSenders},
        message::{BookmarkUpdate, SessionMessage},
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
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub async fn spawn(
        shared_senders: SharedSenders,
        options: ObserveOptions,
        restore_state: Option<RecentSessionStateSnapshot>,
    ) -> Result<SpawnedSession, InitSessionError> {
        let session_id = Uuid::new_v4();

        let (ui_handle, service_handle) = communication::init(shared_senders);

        let (session, callback_rx) = session_core::session::Session::new(session_id).await?;

        let session_info = SessionInfo::from_observe_options(session_id, &options);
        let recent_source = RecentSourceSnapshot::from_observe_origin(options.origin.clone());
        let supports_bookmarks = recent_source.supports_bookmarks();
        let recent_registration = RecentSessionRegistration::new(
            session_info.title.clone(),
            unix_timestamp_now(),
            recent_source,
            options.parser.clone(),
        );
        let recent_source_key = Arc::clone(&recent_registration.source_key);

        let observe_id = Uuid::new_v4();
        let observe_op = ObserveOperation::new(observe_id, options.origin.clone());

        session.observe(observe_id, options)?;

        let ServiceHandle { cmd_rx, senders } = service_handle;

        let service = Self {
            cmd_rx,
            senders,
            session,
            callback_rx,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        let params = InitSessionParams {
            session_info,
            recent_source_key,
            supports_bookmarks,
            communication: ui_handle,
            observe_op,
        };

        Ok(SpawnedSession {
            params,
            recent_registration,
            restore_state,
        })
    }

    #[inline]
    pub fn session_id(&self) -> Uuid {
        self.session.get_uuid()
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id());

        loop {
            select! {
                Some(cmd) = self.cmd_rx.recv() => {
                    match self.handle_command(cmd).await {
                        Ok(ControlFlow::Break(())) => break,
                        Ok(ControlFlow::Continue(())) => {},
                        Err(error) => {
                            log::error!("Error while handling session commands: {error:?}");
                            self.send_error(error).await;
                        }
                    }
                },
                // Callback receiver won't be dropped when session is dropped.
                Some(event) = self.callback_rx.recv() => {
                    if let Err(error)= self.handle_callbacks(event).await {
                        log::error!("Error while handling session callback event: {error:?}");
                        self.send_error(error).await;
                    }
                }
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

    async fn handle_command(
        &mut self,
        cmd: SessionCommand,
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
            SessionCommand::AddBookmarks(rows) => {
                self.add_bookmarks(rows).await?;
            }
            SessionCommand::RemoveBookmark(row) => {
                self.session.remove_bookmark(row).await?;
                let bookmark = vec![BookmarkUpdate {
                    row,
                    is_bookmarked: false,
                }];
                self.senders
                    .send_session_msg(SessionMessage::BookmarkUpdated(bookmark))
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

    async fn add_bookmarks(&mut self, rows: Vec<u64>) -> Result<(), SessionError> {
        let mut added = Vec::new();
        let mut errors = Vec::new();

        for row in rows {
            match self.session.add_bookmark(row).await {
                Ok(()) => added.push(BookmarkUpdate {
                    row,
                    is_bookmarked: true,
                }),
                Err(error) => errors.push((row, error)),
            }
        }

        if !added.is_empty() {
            self.senders
                .send_session_msg(SessionMessage::BookmarkUpdated(added))
                .await;
        }

        match errors.len() {
            0 => Ok(()),
            1 => Err(errors.pop().expect("one error must exist").1.into()),
            _ => {
                let details = errors
                    .into_iter()
                    .map(|(row, error)| format!("- row {row}: {error}"))
                    .join("; ");
                Err(
                    ComputationError::Process(format!("Failed to add bookmarks:\n{details}"))
                        .into(),
                )
            }
        }
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
            CallbackEvent::AttachmentsUpdated { attachment, len } => {
                self.senders
                    .send_session_msg(SessionMessage::AttachmentsUpdated { attachment, len })
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

use std::ops::ControlFlow;

use itertools::Itertools;
use tokio::{select, sync::mpsc};
use uuid::Uuid;

use processor::grabber::LineRange;
use session_core::session::Session;
use stypes::{CallbackEvent, ComputationError, ObserveOptions};

use super::{command::SessionCommand, communication::ServiceHandle, error::SessionError};
use crate::{
    host::notification::AppNotification,
    session::{
        InitSessionError, InitSessionParams,
        communication::{self, ServiceSenders, SharedSenders},
        message::SessionMessage,
        types::{ObserveOperation, OperationPhase},
        ui::{SessionInfo, chart::ChartBar},
    },
};
use operation_track::OperationTracker;

mod operation_track;

#[derive(Debug)]
pub struct SessionService {
    cmd_rx: mpsc::Receiver<SessionCommand>,
    senders: ServiceSenders,
    session: Session,
    ops_tracker: OperationTracker,
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub async fn spawn(
        shared_senders: SharedSenders,
        options: ObserveOptions,
    ) -> Result<InitSessionParams, InitSessionError> {
        let session_id = Uuid::new_v4();

        let (ui_handle, service_handle) = communication::init(shared_senders);

        let (session, callback_rx) = session_core::session::Session::new(session_id).await?;

        let session_info = SessionInfo::from_observe_options(session_id, &options);

        let observe_id = Uuid::new_v4();

        let observe_op = ObserveOperation::new(observe_id, options.origin.clone());

        session.observe(observe_id, options)?;

        let ServiceHandle { cmd_rx, senders } = service_handle;

        let service = Self {
            cmd_rx,
            senders,
            session,
            ops_tracker: OperationTracker::default(),
            callback_rx,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        let info = InitSessionParams {
            session_info,
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
            SessionCommand::ApplySearchFilter(search_filters) => {
                let op_id = Uuid::new_v4();
                debug_assert!(
                    self.ops_tracker.filter_op.is_none(),
                    "filter must be dropped before applying new one"
                );
                self.ops_tracker.filter_op = Some(op_id);
                self.session.apply_search_filters(op_id, search_filters)?;
            }
            SessionCommand::DropSearch => {
                if let Some(filter_op) = self.ops_tracker.filter_op.take() {
                    self.session.abort(Uuid::new_v4(), filter_op)?;
                }
                self.session.drop_search().await?;
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
            SessionCommand::CloseSession => {
                // Session UI can be already dropped at this point, therefore
                // we don't need to send errors to UI in this case.
                for op_id in self.ops_tracker.get_all() {
                    if let Err(err) = self.session.abort(Uuid::new_v4(), op_id) {
                        log::error!("Abort operation failed. {err:?}");
                    }
                }

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
            // TODO AAZ: Search callbacks seem to have duplications. Check
            // how they're used in master.
            //
            // CallbackEvent::SearchUpdated { found, stat } => {
            // }
            CallbackEvent::IndexedMapUpdated { len } => {
                self.senders
                    .send_session_msg(SessionMessage::SearchState { found_count: len })
                    .await;
            }
            CallbackEvent::SearchMapUpdated(filter_matches) => {
                if let Some(list) = filter_matches {
                    // Long process ends when it deliver its initial results.
                    self.ops_tracker.filter_op = None;

                    self.senders
                        .send_session_msg(SessionMessage::SearchResults(list.0))
                        .await;
                }
            }
            CallbackEvent::OperationError { uuid: _, error } => {
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
            event => {
                println!("************** DEBUG: Received unhandled callback: {event:?}");
                log::warn!("Unhandled callback: {event}");
            }
        }

        Ok(())
    }
}

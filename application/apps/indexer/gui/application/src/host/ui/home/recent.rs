//! Recent-sessions UI for the home screen.
//!
//! This module renders the recent-sessions panel and forwards reopen actions to
//! the host service.

use egui::{
    Align, Button, Label, Layout, Response, RichText, Sense, Sides, Ui, UiBuilder, Widget, vec2,
};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    host::{
        command::{HostCommand, OpenRecentSessionParam},
        ui::{
            UiActions,
            storage::{
                RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionSource,
                RecentSessionsStorage,
            },
        },
    },
};

#[derive(Debug)]
pub struct RecentSessionsUi {
    cmd_tx: Sender<HostCommand>,
    /// Arbitrary value to avoid persisting scroll state after app restart.
    scroll_salt: Uuid,
}

impl RecentSessionsUi {
    /// Creates the home-screen recent-sessions UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            cmd_tx,
            scroll_salt: Uuid::new_v4(),
        }
    }

    /// Renders the recent-sessions panel and applies list actions to the
    /// recent-sessions storage domain.
    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        recent_sessions: &mut RecentSessionsStorage,
        ui: &mut Ui,
    ) {
        ui.heading("Recently opened");

        egui::ScrollArea::vertical()
            .id_salt(("recent_files_scroll", self.scroll_salt))
            .show(ui, |ui| {
                ui.label("List of recently opened sessions.");
                ui.add_space(5.0);

                if recent_sessions.sessions.is_empty() {
                    ui.weak("No recent sessions yet.");
                    return;
                }

                let remove_session = {
                    let mut remove_session = None;

                    for session in &recent_sessions.sessions {
                        self.render_recent_item(ui, actions, session, &mut remove_session);
                        ui.add_space(4.0);
                    }

                    remove_session
                };

                if let Some(source_key) = remove_session {
                    recent_sessions.remove_session(&source_key);
                }
            });
    }

    fn render_recent_item(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        session: &RecentSessionSnapshot,
        remove_session: &mut Option<std::sync::Arc<str>>,
    ) -> Response {
        const ROW_HEIGHT: f32 = 50.0;
        // Make sure to update this If row height changed.
        const TEXT_BLOCK_TOP_SPACING: f32 = 8.0;

        let (rect, response) =
            ui.allocate_exact_size(vec2(ui.available_width(), ROW_HEIGHT), Sense::click());

        response.context_menu(|ui| self.render_row_menu(ui, actions, session, remove_session));

        if response.hovered() {
            ui.painter()
                .rect_filled(rect, 0.0, ui.visuals().widgets.hovered.bg_fill);
        }

        const CONTENT_PADDING_X: f32 = 8.0;
        const CONTENT_PADDING_Y: f32 = 0.0;
        let content_rect = rect.shrink2(vec2(CONTENT_PADDING_X, CONTENT_PADDING_Y));

        ui.scope_builder(UiBuilder::new().max_rect(content_rect), |ui| {
            Sides::new()
                .shrink_left()
                .truncate()
                .height(ROW_HEIGHT)
                .show(
                    ui,
                    |ui| {
                        let content = ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                            ui.take_available_width();
                            render_source_badge(ui, session);
                            ui.vertical(|ui| {
                                // We need to to add space here manually because it's not possible
                                // to a center this vertically.
                                ui.add_space(TEXT_BLOCK_TOP_SPACING);
                                Label::new(RichText::new(session.title()).strong())
                                    .truncate()
                                    .ui(ui);

                                Label::new(RichText::new(session.summary()).size(13.0))
                                    .truncate()
                                    .ui(ui);
                            });
                        });
                        content.response.on_hover_ui(|ui| {
                            ui.set_max_width(ui.spacing().tooltip_width);
                            ui.label(session.tooltip());
                        });
                    },
                    |ui| {
                        ui.horizontal_centered(|ui| {
                            if recent_action_button(icons::regular::ARROW_COUNTER_CLOCKWISE)
                                .ui(ui)
                                .on_hover_text("Restore session")
                                .clicked()
                            {
                                self.open_recent_session(
                                    actions,
                                    session,
                                    RecentSessionReopenMode::RestoreSession,
                                );
                            }

                            if recent_action_button(icons::regular::SLIDERS_HORIZONTAL)
                                .ui(ui)
                                .on_hover_text("Open with saved parser configuration")
                                .clicked()
                            {
                                self.open_recent_session(
                                    actions,
                                    session,
                                    RecentSessionReopenMode::RestoreParserConfiguration,
                                );
                            }

                            let clean_open = ui
                                .add_enabled(
                                    session.supports_clean_open(),
                                    recent_action_button(icons::regular::ARROW_SQUARE_OUT),
                                )
                                .on_hover_text(
                                    "Open as a fresh session without restoring saved state",
                                )
                                .on_disabled_hover_text(
                                    "Clean open is currently only available for file sessions",
                                );

                            if clean_open.clicked() {
                                self.open_recent_session(
                                    actions,
                                    session,
                                    RecentSessionReopenMode::OpenClean,
                                );
                            }
                        });
                    },
                );
        });

        if response.double_clicked() {
            self.open_recent_session(actions, session, RecentSessionReopenMode::RestoreSession);
        }

        response
    }

    fn render_row_menu(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        session: &RecentSessionSnapshot,
        remove_session: &mut Option<std::sync::Arc<str>>,
    ) {
        if ui.button("Restore session").clicked() {
            self.open_recent_session(actions, session, RecentSessionReopenMode::RestoreSession);
            ui.close();
        }

        if ui.button("Restore parser settings").clicked() {
            self.open_recent_session(
                actions,
                session,
                RecentSessionReopenMode::RestoreParserConfiguration,
            );
            ui.close();
        }

        if session.supports_clean_open() && ui.button("Open without saved state").clicked() {
            self.open_recent_session(actions, session, RecentSessionReopenMode::OpenClean);
            ui.close();
        }

        ui.separator();

        if ui.button("Remove").clicked() {
            *remove_session = Some(session.source_key.clone());
            ui.close();
        }
    }

    fn open_recent_session(
        &self,
        actions: &mut UiActions,
        snapshot: &RecentSessionSnapshot,
        mode: RecentSessionReopenMode,
    ) {
        let cmd = HostCommand::OpenRecentSession(Box::new(OpenRecentSessionParam {
            snapshot: snapshot.clone(),
            mode,
        }));
        actions.try_send_command(&self.cmd_tx, cmd);
    }
}

fn render_source_badge(ui: &mut Ui, session: &RecentSessionSnapshot) {
    let icon = source_badge_icon(session);
    let icon = RichText::new(icon).size(19.0);
    Label::new(icon).ui(ui);
}

fn source_badge_icon(session: &RecentSessionSnapshot) -> &'static str {
    match session.sources().first() {
        Some(RecentSessionSource::File { .. }) => icons::regular::FILE,
        Some(RecentSessionSource::Stream { transport }) => match transport {
            stypes::Transport::Process(_) => icons::regular::TERMINAL_WINDOW,
            stypes::Transport::TCP(_) => icons::regular::PLUGS_CONNECTED,
            stypes::Transport::UDP(_) => icons::regular::BROADCAST,
            stypes::Transport::Serial(_) => icons::regular::USB,
        },
        None => icons::regular::FILE,
    }
}

fn recent_action_button(icon: &'static str) -> Button<'static> {
    Button::new(RichText::new(icon).size(16.0))
        .frame(false)
        .frame_when_inactive(false)
}

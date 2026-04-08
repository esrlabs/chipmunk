//! Home-screen layout and panel composition.

use egui::{CentralPanel, Panel, Ui};
use tokio::sync::mpsc::Sender;

use self::{file_explorer::FileExplorerUi, recent::RecentSessionsUi};
use crate::common::phosphor::icons;
use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::StreamNames},
    ui::{UiActions, actions::FileDialogOptions, storage::HostStorage},
};

mod file_explorer;
mod recent;

const ACTION_FILES_ID: &str = "action_files";

#[derive(Debug)]
pub struct HomeView {
    file_explorer: FileExplorerUi,
    recent_sessions: RecentSessionsUi,
    cmd_tx: Sender<HostCommand>,
}

impl HomeView {
    /// Creates the home view and its child panel controllers.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            file_explorer: FileExplorerUi::new(cmd_tx.clone()),
            recent_sessions: RecentSessionsUi::new(cmd_tx.clone()),
            cmd_tx,
        }
    }

    /// Renders the home screen and delegates each panel to its dedicated UI
    /// controller.
    pub fn render_content(
        &mut self,
        storage: &mut HostStorage,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        Panel::left("quick actions")
            .size_range(50.0..=150.0)
            .default_size(100.)
            .resizable(true)
            .show_inside(ui, |ui| {
                render_quick_actions(ui, actions, &self.cmd_tx);
            });

        Panel::right("favorite folders")
            .size_range(250.0..=750.0)
            .default_size(350.)
            .resizable(true)
            .show_inside(ui, |ui| {
                self.file_explorer
                    .render_content(actions, &mut storage.file_explorer, ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            self.recent_sessions
                .render_content(actions, &mut storage.recent_sessions, ui);
        });
    }
}

fn render_quick_actions(ui: &mut egui::Ui, actions: &mut UiActions, cmd_tx: &Sender<HostCommand>) {
    if let Some(paths) = actions.file_dialog.take_output(ACTION_FILES_ID)
        && !paths.is_empty()
    {
        actions.try_send_command(cmd_tx, HostCommand::OpenFiles(paths));
    }

    let item_size = egui::vec2(ui.available_width(), 60.0);

    egui::ScrollArea::vertical()
        .id_salt("quick_actions_scroll")
        .show(ui, |ui| {
            action_button(ui, item_size, icons::regular::FOLDER, "File(s)", || {
                actions.file_dialog.pick_files(
                    ACTION_FILES_ID,
                    FileDialogOptions::new().title("Open files(s)"),
                );
            });

            action_button(
                ui,
                item_size,
                icons::regular::PLUGS_CONNECTED,
                "Connections",
                || {
                    actions.try_send_command(
                        cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Udp,
                            parser: ParserNames::Dlt,
                        },
                    );
                },
            );

            action_button(ui, item_size, icons::regular::TERMINAL, "Terminal", || {
                actions.try_send_command(
                    cmd_tx,
                    HostCommand::ConnectionSessionSetup {
                        stream: StreamNames::Process,
                        parser: ParserNames::Text,
                    },
                );
            });
        });
}

fn action_button(
    ui: &mut egui::Ui,
    size: egui::Vec2,
    icon: &str,
    label: &str,
    on_click: impl FnOnce(),
) {
    ui.push_id(format!("quick_action_{}", label.to_lowercase()), |ui| {
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());

        let visuals = ui.style().interact(&response);

        if response.hovered() || response.is_pointer_button_down_on() {
            ui.painter()
                .rect_filled(rect.shrink(2.0), 6.0, visuals.bg_fill);
        }

        let inner_rect = rect.shrink(6.0);

        ui.scope_builder(egui::UiBuilder::new().max_rect(inner_rect), |ui| {
            ui.with_layout(
                egui::Layout::top_down_justified(egui::Align::Center),
                |ui| {
                    ui.add_space(2.0);
                    ui.label(egui::RichText::new(icon).size(22.0));
                    ui.add(
                        egui::Label::new(egui::RichText::new(label).small())
                            .wrap_mode(egui::TextWrapMode::Truncate),
                    );
                },
            );
        });

        if response.clicked() {
            on_click();
        }

        ui.add_space(4.0);
    });
}

use std::{env, mem::take, path::PathBuf};

use egui::{Align, Button, CentralPanel, CollapsingHeader, Layout, Panel, RichText, Ui};
use tokio::sync::mpsc::Sender;

use crate::common::phosphor::icons;
use crate::host::ui::storage::HostStorage;
use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::StreamNames},
    ui::{
        APP_SETTINGS, UiActions,
        actions::FileDialogOptions,
        home::state::{FavoriteFolder, HomeUiState},
        storage::{LoadState, RecentSessionsStorage, SessionConfig},
    },
};

pub mod state;

const ACTION_FILES_ID: &str = "action_files";
const FAVORITES_FOLDER_ID: &str = "favorites_folder";

#[derive(Debug)]
pub struct HomeView {
    pub state: HomeUiState,
    pub data_path: PathBuf,
    cmd_tx: Sender<HostCommand>,
}

impl HomeView {
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        let dir = env::current_dir().expect("Failed to get current working directory");
        let path = dir.join(APP_SETTINGS);
        let state = HomeUiState::load(&path);

        HomeView {
            state,
            data_path: path,
            cmd_tx,
        }
    }

    pub fn save(&self) {
        if let Err(err) = self.state.save(&self.data_path) {
            log::error!("Failed to persist home UI state: {err:#}");
        }
    }

    pub fn render_content(
        &mut self,
        storage: &mut HostStorage,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        let Self { state, cmd_tx, .. } = self;

        Panel::left("quick actions")
            .size_range(50.0..=150.0)
            .default_size(100.)
            .resizable(true)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::top_down_justified(Align::LEFT), |ui| {
                    render_quick_actions(ui, actions, cmd_tx);
                });
            });

        Panel::right("favorite folders")
            .size_range(250.0..=750.0)
            .default_size(350.)
            .resizable(true)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::top_down_justified(Align::LEFT), |ui| {
                    ui.add_space(5.0);
                    ui.heading("Favorite folders");
                    render_favorite_folders(ui, actions, state, cmd_tx);
                });
            });

        CentralPanel::default().show_inside(ui, |ui| {
            ui.with_layout(Layout::top_down_justified(Align::LEFT), |ui| {
                ui.heading("Recently opened");
                render_recent_sessions(ui, actions, &mut storage.recent_sessions, cmd_tx);
            });
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

fn render_recent_sessions(
    ui: &mut egui::Ui,
    actions: &mut UiActions,
    recent_sessions: &mut RecentSessionsStorage,
    cmd_tx: &Sender<HostCommand>,
) {
    egui::ScrollArea::vertical()
        .id_salt("recent_files_scroll")
        .show(ui, |ui| {
            ui.label("List of recently opened sessions.");
            ui.add_space(5.0);

            let (remove_session, remove_cfg) = {
                let LoadState::Ready(data) = &recent_sessions.state else {
                    ui.label("Loading recent sessions...");
                    return;
                };

                let mut remove_session: Option<String> = None;
                let mut remove_cfg: Option<(String, String)> = None;

                for session in &data.sessions {
                    ui.collapsing(session.title.clone(), |ui| {
                        let cfg_len = session.configurations.len();
                        let cfg_tpl = session.new_configuration();

                        if cfg_len > 1 || cfg_tpl.is_some() {
                            ui.horizontal(|ui| {
                                if cfg_len > 1
                                    && ui
                                        .add(
                                            Button::new(
                                                RichText::new(icons::regular::TRASH).size(12.0),
                                            )
                                            .small(),
                                        )
                                        .on_hover_text("Remove all configurations")
                                        .clicked()
                                {
                                    remove_session = Some(session.title.clone());
                                }

                                if let Some(cfg) = cfg_tpl
                                    && ui
                                        .add(
                                            Button::new(
                                                RichText::new(icons::regular::PLUS).size(12.0),
                                            )
                                            .small(),
                                        )
                                        .on_hover_text("New configuration")
                                        .clicked()
                                {
                                    open_new_configuration(actions, cmd_tx, cfg);
                                }
                            });
                        }

                        for cfg in &session.configurations {
                            ui.horizontal(|ui| {
                                if ui
                                    .add(
                                        Button::new(
                                            RichText::new(icons::regular::ARROW_SQUARE_OUT)
                                                .size(12.0),
                                        )
                                        .small(),
                                    )
                                    .on_hover_text("Open configuration")
                                    .clicked()
                                {
                                    open_previous_configuration(actions, cmd_tx, cfg);
                                }

                                if ui
                                    .add(
                                        Button::new(RichText::new(icons::regular::X).size(12.0))
                                            .small(),
                                    )
                                    .on_hover_text("Remove configuration")
                                    .clicked()
                                {
                                    remove_cfg = Some((session.title.clone(), cfg.id.clone()));
                                }

                                ui.label(format!("{}", cfg));
                            });
                        }
                    });
                }

                (remove_session, remove_cfg)
            };

            if let Some((title, id)) = remove_cfg {
                recent_sessions.remove_configuration(&title, &id);
            }

            if let Some(title) = remove_session {
                recent_sessions.remove_session(&title);
            }
        });
}

fn open_new_configuration(
    actions: &mut UiActions,
    cmd_tx: &Sender<HostCommand>,
    cfg: &SessionConfig,
) {
    let cmd = HostCommand::OpenNewConfiguration(Box::new(cfg.options.clone()));
    actions.try_send_command(cmd_tx, cmd);
}

fn open_previous_configuration(
    actions: &mut UiActions,
    cmd_tx: &Sender<HostCommand>,
    cfg: &SessionConfig,
) {
    let cmd = HostCommand::OpenPreviousConfiguration(Box::new(cfg.options.clone()));
    actions.try_send_command(cmd_tx, cmd);
}

fn render_favorite_folders(
    ui: &mut egui::Ui,
    actions: &mut UiActions,
    state: &mut HomeUiState,
    cmd_tx: &Sender<HostCommand>,
) {
    if let Some(paths) = actions.file_dialog.take_output(FAVORITES_FOLDER_ID) {
        for path in paths {
            if state.favorite_folders.iter().any(|f| f.path == path) {
                continue;
            }

            let mut folder = FavoriteFolder::new(path);
            folder.scan();
            state.favorite_folders.push(folder);
        }
    }

    ui.horizontal(|ui| {
        ui.with_layout(egui::Layout::left_to_right(egui::Align::Center), |ui| {
            ui.label("Search:");

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui
                    .add(Button::new(RichText::new(icons::regular::PLUS).size(12.0)).small())
                    .on_hover_text("Add folder")
                    .clicked()
                {
                    actions.file_dialog.pick_folder(
                        FAVORITES_FOLDER_ID,
                        FileDialogOptions::new().title("Select Favorites Folder"),
                    );
                }

                if ui
                    .add(
                        Button::new(RichText::new(icons::regular::ARROWS_CLOCKWISE).size(12.0))
                            .small(),
                    )
                    .on_hover_text("Refresh")
                    .clicked()
                {
                    state.update_favorites();
                }

                let search_response = ui.add(
                    egui::TextEdit::singleline(&mut state.favorite_search)
                        .desired_width(f32::INFINITY)
                        .hint_text("type to filter..."),
                );

                if search_response.changed() && state.favorite_search.is_empty() {
                    state.favorite_collapse = true;
                }
            });
        });
    });

    ui.add_space(2.0);

    egui::ScrollArea::vertical()
        .id_salt("favorite_folders_scroll")
        .show(ui, |ui| {
            let expand = if take(&mut state.favorite_collapse) {
                Some(false)
            } else if !state.favorite_search.is_empty() {
                Some(true)
            } else {
                None
            };

            let mut remove_path: Option<std::path::PathBuf> = None;

            for folder in &state.favorite_folders {
                CollapsingHeader::new(folder.path.display().to_string())
                    .id_salt(folder.path.to_string_lossy())
                    .open(expand)
                    .show(ui, |ui| {
                        if state.favorite_search.is_empty()
                            && ui
                                .add(
                                    Button::new(RichText::new(icons::regular::TRASH).size(12.0))
                                        .small(),
                                )
                                .on_hover_text("Remove folder")
                                .clicked()
                        {
                            remove_path = Some(folder.path.clone());
                        }

                        for file in &folder.files {
                            if !state.favorite_search.is_empty()
                                && !file
                                    .name
                                    .to_lowercase()
                                    .contains(&state.favorite_search.to_lowercase())
                            {
                                continue;
                            }

                            ui.horizontal(|ui| {
                                if ui
                                    .add(
                                        Button::new(
                                            RichText::new(icons::regular::ARROW_SQUARE_OUT)
                                                .size(12.0),
                                        )
                                        .small(),
                                    )
                                    .on_hover_text(format!("Open file ({})", file.size_txt))
                                    .clicked()
                                {
                                    let param = [folder.path.join(&file.name)].to_vec();
                                    let cmd = HostCommand::OpenFiles(param);
                                    actions.try_send_command(cmd_tx, cmd);
                                }
                                ui.label(&file.name);
                            });
                        }
                    });
            }

            if let Some(path) = remove_path {
                state.favorite_folders.retain(|f| f.path != path);
            }
        });
}

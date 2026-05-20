//! Application settings host-tab UI.

use egui::{Align, CentralPanel, Checkbox, Layout, Panel, RichText, ScrollArea, Sense, Ui, vec2};

use crate::{
    common::ui::buttons,
    host::{
        common::ui_utls::main_panel_group_frame,
        ui::{
            state::modal::{ConfirmationAnswer, ConfirmationDialog, HostModalState},
            storage::{HostStorage, settings::AppSettings},
        },
    },
};

/// Confirmation dialog id for closing the settings tab with unapplied changes.
const CLOSE_CONFIRMATION_ID: &str = "app_settings_close_confirmation";

const CONTENT_MAX_WIDTH: f32 = 600.0;

/// Host-tab view for application settings.
#[derive(Debug, Default)]
pub struct AppSettingsView {
    original: AppSettings,
    draft: AppSettings,
}

impl AppSettingsView {
    pub fn new(setting: AppSettings) -> Self {
        Self {
            original: setting.clone(),
            draft: setting,
        }
    }

    /// Renders the settings form and applies accepted changes to host storage.
    pub fn render_content(&mut self, storage: &mut HostStorage, ui: &mut Ui) {
        let mut apply_clicked = false;
        let mut discard_clicked = false;

        Panel::top("app_settings_header")
            .exact_size(40.0)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                    ui.heading("App Settings");
                });
            });

        CentralPanel::default().show_inside(ui, |ui| {
            const ACTIONS_HEIGHT: f32 = 40.0;

            let content_width = ui.available_width().min(CONTENT_MAX_WIDTH);
            let content_height = (ui.available_height() - ACTIONS_HEIGHT).max(0.0);

            ui.with_layout(Layout::top_down(Align::Center), |ui| {
                ui.allocate_ui_with_layout(
                    vec2(content_width, content_height),
                    Layout::top_down(Align::Min),
                    |ui| {
                        ScrollArea::vertical()
                            .id_salt("app_settings_scroll")
                            .show(ui, |ui| {
                                ui.set_width(content_width);
                                ui.add_space(8.0);
                                main_panel_group_frame(ui).show(ui, |ui| {
                                    ui.take_available_width();
                                    ui.label(RichText::new("Updates").heading().size(16.0));
                                    ui.add_space(8.0);

                                    let draft = &mut self.draft;

                                    ui.checkbox(
                                        &mut draft.updates.check_for_updates,
                                        "Check for updates",
                                    )
                                    .on_hover_ui(|ui| {
                                        ui.set_max_width(ui.spacing().tooltip_width);
                                        ui.label("Check for new Chipmunk versions on startup.");
                                    });

                                    let check_for_updates = draft.updates.check_for_updates;
                                    let pre_release_response = ui.add_enabled(
                                        check_for_updates,
                                        Checkbox::new(
                                            &mut draft.updates.check_pre_releases,
                                            "Check pre-releases",
                                        ),
                                    );
                                    ui.interact(
                                        pre_release_response.rect,
                                        pre_release_response.id.with("tooltip"),
                                        Sense::hover(),
                                    )
                                    .on_hover_ui(|ui| {
                                        ui.set_max_width(ui.spacing().tooltip_width);
                                        ui.label(
                                            "Include releases tagged as pre-release. These builds are mainly for testing.",
                                        );
                                    });
                                });
                            });
                    },
                );

                ui.allocate_ui_with_layout(
                    vec2(content_width, ACTIONS_HEIGHT),
                    Layout::right_to_left(Align::Center),
                    |ui| {
                        let has_changes = self.is_dirty();

                        let discard_button =
                            ui.add_enabled(has_changes, buttons::command("Discard", None));
                        if discard_button.clicked() {
                            discard_clicked = true;
                        }

                        let apply_button = ui.add_enabled(
                            has_changes,
                            buttons::command("Apply", None),
                        );
                        if apply_button.clicked() {
                            apply_clicked = true;
                        }
                    },
                );
            });
        });

        if discard_clicked {
            self.discard();
        }

        if apply_clicked {
            let settings = self.draft.clone();
            storage.settings.apply(settings.clone());
            self.original = settings;
        }
    }

    /// Returns whether a pending close confirmation accepted closing this settings tab.
    pub fn should_close_after_confirmation(&mut self, modals: &mut HostModalState) -> bool {
        modals
            .take_confirmation_result(CLOSE_CONFIRMATION_ID)
            .is_some_and(|answer| answer == ConfirmationAnswer::Confirmed)
    }

    pub fn on_close_tab(&self) -> Option<ConfirmationDialog> {
        if self.is_dirty() {
            let dialog = ConfirmationDialog::new(
                CLOSE_CONFIRMATION_ID,
                "Discard settings changes?",
                "You have unapplied settings changes. Close Settings and discard them?",
            )
            .with_confirm_label("Discard")
            .with_cancel_label("Cancel");

            return Some(dialog);
        }

        None
    }

    /// Returns whether the form draft differs from its starting snapshot.
    fn is_dirty(&self) -> bool {
        self.draft != self.original
    }

    /// Replaces the draft with the starting snapshot.
    pub fn discard(&mut self) {
        self.draft.clone_from(&self.original);
    }
}

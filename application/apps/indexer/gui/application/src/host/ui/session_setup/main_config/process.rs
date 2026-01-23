use egui::{Align, Button, Label, Layout, Popup, RectAlign, RichText, TextEdit, Ui, Widget, vec2};

use super::RenderOutcome;
use crate::host::ui::{
    UiActions,
    session_setup::{start_session_on_enter, state::sources::ProcessConfig},
};

const CWD_DIALOG_ID: &str = "cwd_for_shell";

pub fn render_connection(
    config: &mut ProcessConfig,
    actions: &mut UiActions,
    ui: &mut Ui,
) -> RenderOutcome {
    let mut outcome = RenderOutcome::None;
    let row_height = 25.0;
    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), row_height),
        Layout::right_to_left(Align::Center),
        |ui| command_and_shell(config, &mut outcome, ui),
    );

    ui.add_space(10.);

    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), row_height),
        Layout::left_to_right(Align::Center),
        |ui| working_dir(config, actions, ui),
    );

    outcome
}

/// Renders the area to specify the command and the shell to run on it.
fn command_and_shell(config: &mut ProcessConfig, outcome: &mut RenderOutcome, ui: &mut Ui) {
    let height = ui.available_height();

    let shell_txt = RichText::new(format!(
        "{} {}",
        egui_phosphor::regular::TERMINAL,
        config
            .shell
            .as_ref()
            .map(|s| s.shell.to_string())
            .unwrap_or_else(|| String::from("Default Shell"))
    ))
    .text_style(egui::TextStyle::Button);

    let button_res = Button::new(shell_txt).min_size(vec2(0., height)).ui(ui);

    let pop_id = egui::Id::new("shells");

    Popup::menu(&button_res)
        .id(pop_id)
        .align(RectAlign::BOTTOM_START)
        .show(|ui| {
            ui.selectable_value(&mut config.shell, None, "Default Shell");
            ui.separator();
            for shell in &config.available_shells {
                ui.selectable_value(
                    &mut config.shell,
                    Some(shell.to_owned()),
                    shell.shell.to_string(),
                );
            }
        });

    let text_res = TextEdit::singleline(&mut config.command)
        .min_size(vec2(ui.available_width(), height))
        .vertical_align(Align::Center)
        .hint_text("Terminal command")
        .show(ui)
        .response;

    if text_res.changed() {
        config.validate();
    };

    start_session_on_enter(&text_res, || config.is_valid(), outcome);
}

/// Render the area to specify the working directory.
fn working_dir(config: &mut ProcessConfig, actions: &mut UiActions, ui: &mut Ui) {
    if let Some(paths) = actions.file_dialog.take_output(CWD_DIALOG_ID)
        && let Some(cwd) = paths.into_iter().next()
    {
        config.cwd = cwd;
    }

    let height = ui.available_height() - 2.;

    let path_txt = format!("{}", config.cwd.display());

    egui::Sides::new().show(
        ui,
        |ui| {
            Label::new("Working Folder:").selectable(false).ui(ui);
            Label::new(path_txt).ui(ui);
        },
        |ui| {
            let btn_size = vec2(12., height);

            let open_txt = RichText::new(egui_phosphor::regular::FOLDER_OPEN)
                .size(16.)
                .text_style(egui::TextStyle::Button);
            let open_btn = Button::new(open_txt)
                .min_size(btn_size)
                .ui(ui)
                .on_hover_text("Browse");

            if open_btn.clicked() {
                actions.file_dialog.pick_folder(CWD_DIALOG_ID);
            }

            let home_txt = RichText::new(egui_phosphor::regular::HOUSE)
                .size(16.)
                .text_style(egui::TextStyle::Button);
            let home_btn = Button::new(home_txt)
                .min_size(btn_size)
                .ui(ui)
                .on_hover_text("Set to Home Directory");

            if home_btn.clicked()
                && let Some(home) = dirs::home_dir()
            {
                config.cwd = home;
            }
        },
    );
}

use egui::RichText;

use crate::{
    common::phosphor::{self, icons},
    host::ui::{
        UiActions,
        actions::{FileDialogFilter, FileDialogOptions},
        session_setup::state::parsers::FibexFileInfo,
    },
};

pub fn fibex_file_selector(
    file_dialog_id: &str,
    dialog_title: &str,
    fibex_files: &mut Vec<FibexFileInfo>,
    actions: &mut UiActions,
    ui: &mut egui::Ui,
) {
    if let Some(files) = actions.file_dialog.take_output(file_dialog_id) {
        fibex_files.extend(files.into_iter().map(FibexFileInfo::from_path_lossy));
    }

    ui.label("Fibex Files");
    ui.label(RichText::new("Attach fibex files (optional)").small());
    ui.add_space(5.0);

    let mut add_txt = egui::text::LayoutJob::default();
    add_txt.append(
        icons::fill::FILE_PLUS,
        0.0,
        egui::text::TextFormat {
            font_id: egui::FontId::new(17.0, phosphor::fill_font_family()),
            ..Default::default()
        },
    );

    add_txt.append("Add", 3.0, egui::text::TextFormat::default());

    if ui.button(add_txt).clicked() {
        actions.file_dialog.pick_files(
            file_dialog_id,
            FileDialogOptions::new()
                .title(dialog_title)
                .filter(FileDialogFilter::new("FIBEX", vec![String::from("xml")])),
        );
    }

    let mut to_remove = None;

    for (idx, fibex) in fibex_files.iter().enumerate() {
        ui.horizontal(|ui| {
            ui.label(&fibex.name).on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);

                ui.label(format!("{}", fibex.path.display()));
            });

            if ui.button("❌").on_hover_text("Remove File").clicked() {
                to_remove = Some(idx);
            }
        });
    }

    if let Some(remove_idx) = to_remove.take() {
        fibex_files.remove(remove_idx);
    }
}

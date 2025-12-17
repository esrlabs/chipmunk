use egui::Ui;

use super::RenderOutcome;
use crate::host::ui::session_setup::state::{parsers::DltParserConfig, sources::SourceFileInfo};

pub fn render_statistics(
    _file: &SourceFileInfo,
    _parser: &DltParserConfig,
    ui: &mut Ui,
) -> RenderOutcome {
    ui.centered_and_justified(|ui| {
        ui.heading("DLT Statistics Coming Soon");
    });
    RenderOutcome::None
}

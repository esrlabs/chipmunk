//! Module for shared utilities regarding communication across the whole app.

use tokio::sync::mpsc::error::SendError;

/// Evaluate send results waking up the UI when successful and returning `true`.
/// Otherwise, log the dropped delivery at trace level and return `false`.
pub fn evaluate_send_res<T>(
    egui_ctx: &egui::Context,
    send_result: Result<(), SendError<T>>,
) -> bool {
    match send_result {
        Ok(()) => {
            egui_ctx.request_repaint();
            true
        }
        Err(error) => {
            log::trace!("UI channel delivery dropped: {error}");
            false
        }
    }
}

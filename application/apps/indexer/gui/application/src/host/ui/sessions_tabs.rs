use egui::{Atom, Button, Popup, Ui};

use super::{HostState, TabType, UiActions};

pub fn render(state: &mut HostState, actions: &mut UiActions, ui: &mut Ui) {
    let HostState {
        active_tab,
        sessions,
    } = state;

    for (idx, session) in sessions.iter().enumerate() {
        // egui doesn't provide tab control and we can't add all UI controls
        // This solution will inject a button to close the session.
        // TODO AAZ: Build tab control instead of this workaround.
        let close_id = egui::Id::new("close_id");
        let res = egui::Button::selectable(
            *active_tab == TabType::Session(idx),
            (
                session.get_info().title.as_str(),
                Atom::custom(close_id, egui::Vec2::splat(18.0)),
            ),
        )
        .atom_ui(ui);

        if res.response.clicked() {
            *active_tab = TabType::Session(idx);
        }

        if let Some(close_rec) = res.rect(close_id) {
            let close_btn_res = ui
                .place(close_rec, Button::new("❌").frame(false))
                .on_hover_text("Close Session");

            if close_btn_res.clicked() {
                sessions[idx].close_session(actions);
            }
        }

        // Close session on middle click.
        if res.response.middle_clicked() {
            sessions[idx].close_session(actions);
        }

        // Context menu
        Popup::context_menu(&res.response).show(|ui| {
            if ui.button("Close").clicked() {
                sessions[idx].close_session(actions);
            }
        });
    }
}

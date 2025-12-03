use std::collections::HashMap;

use egui::{Atom, Button, Popup, RichText, Ui};
use uuid::Uuid;

use crate::{host::ui::state::HOME_TAB_IDX, session::ui::Session};

use super::{HostState, UiActions};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabType {
    Home,
    Session(Uuid),
}

pub fn render_tabs(state: &mut HostState, actions: &mut UiActions, ui: &mut Ui) {
    let HostState {
        active_tab_idx,
        tabs,
        sessions,
    } = state;

    for (idx, tab) in tabs.iter().enumerate() {
        match tab {
            TabType::Home => home_tab(active_tab_idx, ui),
            TabType::Session(uuid) => session_tab(uuid, idx, active_tab_idx, sessions, actions, ui),
        }
    }
}

fn home_tab(active_tab_idx: &mut usize, ui: &mut Ui) {
    ui.selectable_value(active_tab_idx, HOME_TAB_IDX, RichText::new("🏠").size(17.))
        .on_hover_text("Home");
}

fn session_tab(
    session_id: &Uuid,
    tab_idx: usize,
    active_tab_idx: &mut usize,
    sessions: &HashMap<Uuid, Session>,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    // egui doesn't provide tab control and we can't add all UI controls
    // This solution will inject a button to close the session.
    // TODO AAZ: Build tab control instead of this workaround.
    let close_id = egui::Id::new("close_id");
    let res = egui::Button::selectable(
        *active_tab_idx == tab_idx,
        (
            sessions[&session_id].get_info().title.as_str(),
            Atom::custom(close_id, egui::Vec2::splat(18.0)),
        ),
    )
    .atom_ui(ui);

    if res.response.clicked() {
        *active_tab_idx = tab_idx;
    }

    if let Some(close_rec) = res.rect(close_id) {
        let close_btn_res = ui
            .place(close_rec, Button::new("❌").frame(false))
            .on_hover_text("Close Session");

        if close_btn_res.clicked() {
            sessions[&session_id].close_session(actions);
        }
    }

    // Close session on middle click.
    if res.response.middle_clicked() {
        sessions[&session_id].close_session(actions);
    }

    // Context menu
    Popup::context_menu(&res.response).show(|ui| {
        if ui.button("Close").clicked() {
            sessions[&session_id].close_session(actions);
        }
    });
}

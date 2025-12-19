use std::collections::HashMap;

use egui::{Atom, Button, FontFamily, FontId, Popup, RichText, Ui};
use uuid::Uuid;

use crate::{
    common::phosphor::{self, icons},
    host::ui::{session_setup::SessionSetup, state::HOME_TAB_IDX},
    session::ui::Session,
};

use super::{HostState, UiActions};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabType {
    Home,
    Session(Uuid),
    SessionSetup(Uuid),
}

pub fn render_all_tabs(state: &mut HostState, actions: &mut UiActions, ui: &mut Ui) {
    let HostState {
        active_tab_idx,
        tabs,
        sessions,
        session_setups,
    } = state;

    for (idx, tab) in tabs.iter().enumerate() {
        match tab {
            TabType::Home => home_tab(active_tab_idx, ui),
            TabType::Session(uuid) => session_tab(uuid, idx, active_tab_idx, sessions, actions, ui),
            TabType::SessionSetup(uuid) => {
                setup_session_tab(uuid, idx, active_tab_idx, session_setups, actions, ui)
            }
        }
    }
}

fn home_tab(active_tab_idx: &mut usize, ui: &mut Ui) {
    ui.selectable_value(
        active_tab_idx,
        HOME_TAB_IDX,
        RichText::new(icons::fill::HOUSE)
            .family(phosphor::fill_font_family())
            .size(18.),
    )
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
    let title = sessions[session_id].get_info().title.as_str();
    render_single_tab(title, tab_idx, active_tab_idx, ui, || {
        sessions[session_id].close_session(actions)
    });
}

fn setup_session_tab(
    id: &Uuid,
    tab_idx: usize,
    active_tab_idx: &mut usize,
    setups: &HashMap<Uuid, SessionSetup>,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    let title = setups[id].title();
    render_single_tab(title, tab_idx, active_tab_idx, ui, || {
        setups[id].close(actions)
    });
}

/// Render one single tab with the provided content and the close function.
/// NOTE: This can be updated with full context menu for each separated tab.
fn render_single_tab<F>(
    content: &str,
    tab_idx: usize,
    active_tab_idx: &mut usize,
    ui: &mut Ui,
    mut close_fn: F,
) where
    F: FnMut(),
{
    // egui doesn't provide tab control and we can't add all UI controls
    // This solution will inject a button to close the session.
    // TODO AAZ: Build tab control instead of this workaround.
    let close_id = egui::Id::new("close_id");
    let res = egui::Button::selectable(
        *active_tab_idx == tab_idx,
        (content, Atom::custom(close_id, egui::Vec2::splat(18.0))),
    )
    .atom_ui(ui);

    if res.response.clicked() {
        *active_tab_idx = tab_idx;
    }

    if let Some(close_rec) = res.rect(close_id) {
        let close_btn_res = ui
            .place(close_rec, Button::new(icons::regular::X).frame(false))
            .on_hover_text("Close Session");

        if close_btn_res.clicked() {
            close_fn();
        }
    }

    // Close session on middle click.
    if res.response.middle_clicked() {
        close_fn();
    }

    // Context menu
    Popup::context_menu(&res.response).show(|ui| {
        if ui.button("Close").clicked() {
            close_fn();
        }
    });
}

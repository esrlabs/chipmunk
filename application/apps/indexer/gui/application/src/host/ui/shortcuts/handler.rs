//! Dispatches host-level shortcuts before forwarding unconsumed shortcuts to the active session.

use egui::{Context, Event};

use crate::host::ui::{
    Host, HostAction,
    actions::FileDialogOptions,
    menu,
    state::{self, HostModal},
    tabs::TabType,
};

use super::{
    definitions::{AppShortcuts, OPEN_SHORTCUTS_F1, app_shortcuts},
    matching::{consume_binding, consume_questionmark, consume_shortcut},
    state::LastShortcutKey,
};

/// Handles host and active-tab shortcuts, returning true when a shortcut is consumed.
pub fn handle(host: &mut Host, ctx: &Context) -> bool {
    if ctx.memory(|memory| memory.top_modal_layer().is_some()) {
        host.state.shortcuts.clear_last_key();
        return false;
    }

    if !has_key_press(ctx) {
        return false;
    }

    // Take last key when on new key press regardless if it will be used or not.
    // The new key will be stored in case it's not consumed.
    let last_key = host.state.shortcuts.take_last_key(ctx);

    if handle_app_shortcuts(host, ctx) {
        return true;
    }

    if handle_active_tab_shortcuts(host, ctx, last_key.as_ref()) {
        return true;
    }

    if ctx.text_edit_focused() {
        return false;
    }

    host.state.shortcuts.store_last_key(ctx);
    false
}

/// Returns true when a key press event exists in the current frame.
fn has_key_press(ctx: &Context) -> bool {
    ctx.input(|input| {
        input
            .events
            .iter()
            .any(|event| matches!(event, Event::Key { pressed: true, .. }))
    })
}

fn handle_app_shortcuts(host: &mut Host, ctx: &Context) -> bool {
    let AppShortcuts {
        home_tab,
        open_files,
        close_tab,
        previous_tab,
        next_tab,
        tab_1,
        tab_2,
        tab_3,
        tab_4,
        tab_5,
        tab_6,
        tab_7,
        tab_8,
        tab_9,
        toggle_right_panel,
        toggle_bottom_panel,
        open_shortcuts: _,
    } = app_shortcuts();

    if consume_shortcut(ctx, home_tab) {
        host.state.activate_tab(state::HOME_TAB_IDX);
        return true;
    }

    if consume_shortcut(ctx, open_files) {
        host.ui_actions.file_dialog.pick_files(
            menu::OPEN_FILES_ID,
            FileDialogOptions::new().title("Open Files"),
        );
        return true;
    }

    if consume_shortcut(ctx, close_tab) {
        close_active_tab(host);
        return true;
    }

    if consume_shortcut(ctx, previous_tab) {
        host.state.activate_previous_tab();
        return true;
    }

    if consume_shortcut(ctx, next_tab) {
        host.state.activate_next_tab();
        return true;
    }

    if consume_shortcut(ctx, tab_1) {
        host.state.activate_tab(0);
        return true;
    }

    if consume_shortcut(ctx, tab_2) {
        host.state.activate_tab(1);
        return true;
    }

    if consume_shortcut(ctx, tab_3) {
        host.state.activate_tab(2);
        return true;
    }

    if consume_shortcut(ctx, tab_4) {
        host.state.activate_tab(3);
        return true;
    }

    if consume_shortcut(ctx, tab_5) {
        host.state.activate_tab(4);
        return true;
    }

    if consume_shortcut(ctx, tab_6) {
        host.state.activate_tab(5);
        return true;
    }

    if consume_shortcut(ctx, tab_7) {
        host.state.activate_tab(6);
        return true;
    }

    if consume_shortcut(ctx, tab_8) {
        host.state.activate_tab(7);
        return true;
    }

    if consume_shortcut(ctx, tab_9) {
        host.state.activate_tab(8);
        return true;
    }

    if host.state.show_right_panel_toggle() && consume_shortcut(ctx, toggle_right_panel) {
        host.state.panels_visibility.right = !host.state.panels_visibility.right;
        return true;
    }

    if host.state.show_bottom_panel_toggle() && consume_shortcut(ctx, toggle_bottom_panel) {
        host.state.panels_visibility.bottom = !host.state.panels_visibility.bottom;
        return true;
    }

    if consume_binding(ctx, &OPEN_SHORTCUTS_F1) || consume_questionmark(ctx) {
        host.state.active_modal = Some(HostModal::Shortcuts);
        return true;
    }

    false
}

fn handle_active_tab_shortcuts(
    host: &mut Host,
    ctx: &Context,
    last_key: Option<&LastShortcutKey>,
) -> bool {
    let Host {
        state, ui_actions, ..
    } = host;

    let TabType::Session(session_id) = state.active_tab().clone() else {
        return false;
    };

    let Some(session) = state.sessions.get_mut(&session_id) else {
        return false;
    };

    session.handle_shortcuts(ui_actions, &mut state.panels_visibility, ctx, last_key)
}

fn close_active_tab(host: &mut Host) {
    match host.state.active_tab().clone() {
        TabType::Home => {}
        TabType::Session(id) => host
            .ui_actions
            .add_host_action(HostAction::CloseSession(id)),
        TabType::SessionSetup(id) => host
            .state
            .session_setups
            .get(&id)
            .expect("Session setup from active tab must exist")
            .close(&mut host.ui_actions),
        TabType::MultiFileSetup(id) => host
            .state
            .multi_setups
            .get(&id)
            .expect("Multiple files setup from active tab must exist")
            .close(&mut host.ui_actions),
    }
}

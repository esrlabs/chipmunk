use egui::{Context, Event, ImeEvent, Key, KeyboardShortcut, Modifiers};

use super::{Host, HostAction, actions::FileDialogOptions, menu, tabs::TabType};

/// Creates a shortcut bound to both Cmd/Ctrl+key and Alt+key.
macro_rules! cmd_alt {
    ($key:expr) => {
        Shortcut {
            bindings: &[
                KeyboardShortcut::new(Modifiers::COMMAND, $key),
                KeyboardShortcut::new(Modifiers::ALT, $key),
            ],
        }
    };
}

#[cfg(target_os = "macos")]
const CLOSE_TAB_BINDINGS: &[KeyboardShortcut] =
    &[KeyboardShortcut::new(Modifiers::COMMAND, Key::W)];

#[cfg(not(target_os = "macos"))]
const CLOSE_TAB_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(Modifiers::COMMAND.plus(Modifiers::SHIFT), Key::W),
    KeyboardShortcut::new(Modifiers::ALT, Key::W),
];

const SHORTCUTS: AppShortcuts = AppShortcuts {
    open_files: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::O)],
    },
    close_tab: Shortcut {
        bindings: CLOSE_TAB_BINDINGS,
    },
    // NOTE: Home is currently the new-session entry point. Present this shortcut as starting a
    // new session, not as generic Home navigation.
    home_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::N)],
    },
    previous_tab: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::COMMAND.plus(Modifiers::SHIFT), Key::Tab),
            KeyboardShortcut::new(Modifiers::CTRL.plus(Modifiers::SHIFT), Key::Tab),
        ],
    },
    next_tab: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::COMMAND, Key::Tab),
            KeyboardShortcut::new(Modifiers::CTRL, Key::Tab),
        ],
    },
    tab_1: cmd_alt!(Key::Num1),
    tab_2: cmd_alt!(Key::Num2),
    tab_3: cmd_alt!(Key::Num3),
    tab_4: cmd_alt!(Key::Num4),
    tab_5: cmd_alt!(Key::Num5),
    tab_6: cmd_alt!(Key::Num6),
    tab_7: cmd_alt!(Key::Num7),
    tab_8: cmd_alt!(Key::Num8),
    tab_9: cmd_alt!(Key::Num9),
    toggle_right_panel: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::B)],
    },
    toggle_bottom_panel: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::J)],
    },
};

/// App-wide keyboard shortcuts handled by the host before active-tab shortcuts.
struct AppShortcuts {
    open_files: Shortcut,
    close_tab: Shortcut,
    home_tab: Shortcut,
    previous_tab: Shortcut,
    next_tab: Shortcut,
    tab_1: Shortcut,
    tab_2: Shortcut,
    tab_3: Shortcut,
    tab_4: Shortcut,
    tab_5: Shortcut,
    tab_6: Shortcut,
    tab_7: Shortcut,
    tab_8: Shortcut,
    tab_9: Shortcut,
    toggle_right_panel: Shortcut,
    toggle_bottom_panel: Shortcut,
}

/// Logical shortcut action with one or more keyboard bindings.
pub struct Shortcut {
    /// Keyboard combinations that trigger this shortcut.
    pub bindings: &'static [KeyboardShortcut],
}

/// Handles host and active-tab shortcuts, returning true when a shortcut is consumed.
pub fn handle(host: &mut Host, ctx: &Context) -> bool {
    if ctx.memory(|memory| memory.top_modal_layer().is_some()) {
        return false;
    }

    if !has_key_press(ctx) {
        return false;
    }

    if handle_app_shortcuts(host, ctx) {
        return true;
    }

    if handle_active_tab_shortcuts(host, ctx) {
        return true;
    }

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
        open_files,
        close_tab,
        home_tab,
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
    } = &SHORTCUTS;

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

    if consume_shortcut(ctx, home_tab) {
        host.state.activate_tab(super::state::HOME_TAB_IDX);
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

    false
}

fn handle_active_tab_shortcuts(host: &mut Host, ctx: &Context) -> bool {
    let TabType::Session(session_id) = host.state.active_tab().clone() else {
        return false;
    };

    let Some(session) = host.state.sessions.get_mut(&session_id) else {
        return false;
    };

    session.handle_shortcuts(&mut host.state.panels_visibility, ctx)
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

/// Consumes one matching shortcut press using exact modifier matching.
///
/// `egui::InputState::consume_shortcut` intentionally ignores extra Shift/Alt modifiers for
/// layout-friendly text shortcuts. App shortcuts need stricter matching so `Cmd/Ctrl+Shift+F`
/// does not also trigger `Cmd/Ctrl+F`.
pub fn consume_shortcut(ctx: &Context, shortcut: &Shortcut) -> bool {
    shortcut.bindings.iter().any(|binding| {
        ctx.input_mut(|input| {
            let mut consumed = false;
            input.events.retain(|event| {
                let matched = shortcut_matches_event(binding, event);
                consumed |= matched;
                !matched
            });

            if consumed {
                // Some Alt shortcuts also emit text input on Linux/layout combinations.
                // Once a shortcut owns the key press, prevent the focused text field from
                // receiving the same input as typed text.
                input.events.retain(|event| !is_text_input_event(event));
            }

            consumed
        })
    })
}

/// Returns true for events that can insert text into focused text widgets.
fn is_text_input_event(event: &Event) -> bool {
    matches!(event, Event::Text(_) | Event::Ime(ImeEvent::Commit(_)))
}

fn shortcut_matches_event(binding: &KeyboardShortcut, event: &Event) -> bool {
    let Event::Key {
        key,
        physical_key,
        modifiers,
        pressed: true,
        ..
    } = event
    else {
        return false;
    };

    modifiers.matches_exact(binding.modifiers)
        && (*key == binding.logical_key
            || digit_physical_key_matches(binding.logical_key, *physical_key))
}

/// Matches positional digit shortcuts by physical key.
///
/// `Shift+digit` can produce a punctuation logical key. For example, on common Linux layouts,
/// `Ctrl+Shift+1` arrives as logical `Key::Exclamationmark` with physical `Key::Num1`. Other
/// shifted digits may appear to work without this fallback only because egui does not model every
/// shifted symbol and falls back to the physical digit key. That behavior is layout-dependent.
///
/// Keep this fallback limited to digits: shortcuts like `Cmd/Ctrl+F` are named actions and should
/// follow the user's logical keyboard layout (for example: ctrl+f stays ctrl+f on Dvorak Layout),
/// while tab-number shortcuts are positional.
fn digit_physical_key_matches(binding_key: Key, physical_key: Option<Key>) -> bool {
    matches!(
        binding_key,
        Key::Num0
            | Key::Num1
            | Key::Num2
            | Key::Num3
            | Key::Num4
            | Key::Num5
            | Key::Num6
            | Key::Num7
            | Key::Num8
            | Key::Num9
    ) && physical_key == Some(binding_key)
}

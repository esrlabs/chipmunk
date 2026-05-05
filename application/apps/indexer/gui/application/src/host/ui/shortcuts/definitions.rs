//! App-wide shortcut definitions shared by handling and the shortcuts overview.

use egui::{Key, KeyboardShortcut, Modifiers};

#[cfg(target_os = "macos")]
const CLOSE_TAB_BINDINGS: &[KeyboardShortcut] =
    &[KeyboardShortcut::new(Modifiers::COMMAND, Key::W)];

#[cfg(not(target_os = "macos"))]
const CLOSE_TAB_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(Modifiers::COMMAND.plus(Modifiers::SHIFT), Key::W),
    KeyboardShortcut::new(Modifiers::ALT, Key::W),
];

pub const OPEN_SHORTCUTS_F1: KeyboardShortcut = KeyboardShortcut::new(Modifiers::NONE, Key::F1);
const OPEN_SHORTCUTS_QUESTIONMARK: KeyboardShortcut =
    KeyboardShortcut::new(Modifiers::NONE, Key::Questionmark);

static SHORTCUTS: AppShortcuts = AppShortcuts {
    home_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::T)],
        description: "Home",
    },
    open_files: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::O)],
        description: "Open file(s)",
    },
    close_tab: Shortcut {
        bindings: CLOSE_TAB_BINDINGS,
        description: "Close active tab",
    },
    previous_tab: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::COMMAND.plus(Modifiers::SHIFT), Key::Tab),
            KeyboardShortcut::new(Modifiers::CTRL.plus(Modifiers::SHIFT), Key::Tab),
        ],
        description: "Activate previous tab",
    },
    next_tab: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::COMMAND, Key::Tab),
            KeyboardShortcut::new(Modifiers::CTRL, Key::Tab),
        ],
        description: "Activate next tab",
    },
    tab_1: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num1)],
        description: "Activate tab 1",
    },
    tab_2: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num2)],
        description: "Activate tab 2",
    },
    tab_3: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num3)],
        description: "Activate tab 3",
    },
    tab_4: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num4)],
        description: "Activate tab 4",
    },
    tab_5: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num5)],
        description: "Activate tab 5",
    },
    tab_6: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num6)],
        description: "Activate tab 6",
    },
    tab_7: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num7)],
        description: "Activate tab 7",
    },
    tab_8: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num8)],
        description: "Activate tab 8",
    },
    tab_9: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::ALT, Key::Num9)],
        description: "Activate tab 9",
    },
    toggle_right_panel: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::B)],
        description: "Toggle right panel",
    },
    toggle_bottom_panel: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::J)],
        description: "Toggle bottom panel",
    },
    open_shortcuts: Shortcut {
        bindings: &[OPEN_SHORTCUTS_F1, OPEN_SHORTCUTS_QUESTIONMARK],
        description: "Show keyboard shortcuts",
    },
};

/// App-wide keyboard shortcuts handled by the host before active-tab shortcuts.
pub struct AppShortcuts {
    pub home_tab: Shortcut,
    pub open_files: Shortcut,
    pub close_tab: Shortcut,
    pub previous_tab: Shortcut,
    pub next_tab: Shortcut,
    pub tab_1: Shortcut,
    pub tab_2: Shortcut,
    pub tab_3: Shortcut,
    pub tab_4: Shortcut,
    pub tab_5: Shortcut,
    pub tab_6: Shortcut,
    pub tab_7: Shortcut,
    pub tab_8: Shortcut,
    pub tab_9: Shortcut,
    pub toggle_right_panel: Shortcut,
    pub toggle_bottom_panel: Shortcut,
    pub open_shortcuts: Shortcut,
}

/// Logical shortcut action with one or more keyboard bindings.
pub struct Shortcut {
    /// Keyboard combinations that trigger this shortcut.
    pub bindings: &'static [KeyboardShortcut],
    /// User-facing description shown in the shortcuts overview.
    pub description: &'static str,
}

pub fn app_shortcuts() -> &'static AppShortcuts {
    &SHORTCUTS
}

pub fn app_shortcut_defs() -> [&'static Shortcut; 17] {
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
        open_shortcuts,
    } = &SHORTCUTS;

    [
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
        open_shortcuts,
    ]
}

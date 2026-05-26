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
    home_tab: Shortcut::new(&[KeyboardShortcut::new(Modifiers::COMMAND, Key::T)], "Home"),
    open_files: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::COMMAND, Key::O)],
        "Open file(s)",
    ),
    quick_open: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::COMMAND, Key::P)],
        "Quick Open",
    ),
    command_palette: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::P,
        )],
        "Command Palette",
    ),
    close_tab: Shortcut::new(CLOSE_TAB_BINDINGS, "Close active tab"),
    previous_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Tab,
        )],
        "Activate previous tab",
    ),
    next_tab: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::COMMAND, Key::Tab)],
        "Activate next tab",
    ),
    // The modal lists this once as Alt+1..9 instead of repeating every tab position.
    tab_1: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num1)],
        "Activate tab by position",
    )
    .with_display(ShortcutDisplay::OverrideText("Alt+1..9")),
    tab_2: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num2)],
        "Activate tab 2",
    ),
    tab_3: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num3)],
        "Activate tab 3",
    ),
    tab_4: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num4)],
        "Activate tab 4",
    ),
    tab_5: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num5)],
        "Activate tab 5",
    ),
    tab_6: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num6)],
        "Activate tab 6",
    ),
    tab_7: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num7)],
        "Activate tab 7",
    ),
    tab_8: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num8)],
        "Activate tab 8",
    ),
    tab_9: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::ALT, Key::Num9)],
        "Activate tab 9",
    ),
    toggle_right_panel: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::COMMAND, Key::B)],
        "Toggle right panel",
    ),
    toggle_bottom_panel: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::COMMAND, Key::J)],
        "Toggle bottom panel",
    ),
    open_shortcuts: Shortcut::new(
        &[OPEN_SHORTCUTS_F1, OPEN_SHORTCUTS_QUESTIONMARK],
        "Show keyboard shortcuts",
    ),
};

/// App-wide keyboard shortcuts handled by the host before active-tab shortcuts.
pub struct AppShortcuts {
    pub home_tab: Shortcut,
    pub open_files: Shortcut,
    /// Opens the Quick Open launcher.
    pub quick_open: Shortcut,
    /// Opens the global command launcher.
    pub command_palette: Shortcut,
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
    /// Presentation override for the shortcuts overview.
    pub display: ShortcutDisplay,
}

#[derive(Clone, Copy)]
pub enum ShortcutDisplay {
    Default,
    OverrideText(&'static str),
    Skip,
}

impl Shortcut {
    pub const fn new(bindings: &'static [KeyboardShortcut], description: &'static str) -> Self {
        Self {
            bindings,
            description,
            display: ShortcutDisplay::Default,
        }
    }

    pub const fn with_display(self, display: ShortcutDisplay) -> Self {
        Self {
            bindings: self.bindings,
            description: self.description,
            display,
        }
    }
}

pub fn app_shortcuts() -> &'static AppShortcuts {
    &SHORTCUTS
}

pub fn app_shortcut_defs() -> [&'static Shortcut; 11] {
    let AppShortcuts {
        home_tab,
        open_files,
        quick_open,
        command_palette,
        close_tab,
        previous_tab,
        next_tab,
        tab_1,
        tab_2: _,
        tab_3: _,
        tab_4: _,
        tab_5: _,
        tab_6: _,
        tab_7: _,
        tab_8: _,
        tab_9: _,
        toggle_right_panel,
        toggle_bottom_panel,
        open_shortcuts,
    } = &SHORTCUTS;

    [
        home_tab,
        open_files,
        quick_open,
        command_palette,
        close_tab,
        toggle_right_panel,
        toggle_bottom_panel,
        next_tab,
        previous_tab,
        tab_1,
        open_shortcuts,
    ]
}

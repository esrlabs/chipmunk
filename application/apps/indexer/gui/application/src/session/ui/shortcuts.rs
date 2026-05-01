use egui::{Context, Key, KeyboardShortcut, Modifiers};

use crate::host::ui::{
    shortcuts::{Shortcut, consume_shortcut},
    state::PanelsVisibility,
};

use super::{
    Session, bottom_panel::BottomTabType, common::log_table::table::TableScroll,
    side_panel::SideTabType,
};

const CTRL_SHIFT: Modifiers = Modifiers::CTRL.plus(Modifiers::SHIFT);

// Alt aliases avoid Linux Ctrl+Shift+U Unicode input, but macOS Option+letter is text input.
#[cfg(target_os = "macos")]
const SEARCH_PAGE_UP_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::PageUp),
    KeyboardShortcut::new(CTRL_SHIFT, Key::U),
];

#[cfg(not(target_os = "macos"))]
const SEARCH_PAGE_UP_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::PageUp),
    KeyboardShortcut::new(CTRL_SHIFT, Key::U),
    KeyboardShortcut::new(Modifiers::ALT, Key::U),
];

#[cfg(target_os = "macos")]
const SEARCH_PAGE_DOWN_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::PageDown),
    KeyboardShortcut::new(CTRL_SHIFT, Key::D),
];

#[cfg(not(target_os = "macos"))]
const SEARCH_PAGE_DOWN_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::PageDown),
    KeyboardShortcut::new(CTRL_SHIFT, Key::D),
    KeyboardShortcut::new(Modifiers::ALT, Key::D),
];

#[cfg(target_os = "macos")]
const SEARCH_TOP_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::Home),
    KeyboardShortcut::new(CTRL_SHIFT, Key::T),
];

#[cfg(not(target_os = "macos"))]
const SEARCH_TOP_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::Home),
    KeyboardShortcut::new(CTRL_SHIFT, Key::T),
    KeyboardShortcut::new(Modifiers::ALT, Key::T),
];

#[cfg(target_os = "macos")]
const SEARCH_BOTTOM_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::End),
    KeyboardShortcut::new(CTRL_SHIFT, Key::E),
];

#[cfg(not(target_os = "macos"))]
const SEARCH_BOTTOM_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(CTRL_SHIFT, Key::End),
    KeyboardShortcut::new(CTRL_SHIFT, Key::E),
    KeyboardShortcut::new(Modifiers::ALT, Key::E),
];

const SHORTCUTS: SessionShortcuts = SessionShortcuts {
    activate_search_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::F)],
    },
    activate_filters_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::F,
        )],
    },
    activate_observing_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::O,
        )],
    },
    activate_attachments_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Y,
        )],
    },
    activate_bottom_search_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num1,
        )],
    },
    activate_details_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num2,
        )],
    },
    activate_library_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num3,
        )],
    },
    activate_presets_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num4,
        )],
    },
    activate_chart_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num5,
        )],
    },
    main_page_up: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::CTRL, Key::PageUp),
            KeyboardShortcut::new(Modifiers::CTRL, Key::U),
        ],
    },
    main_page_down: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::CTRL, Key::PageDown),
            KeyboardShortcut::new(Modifiers::CTRL, Key::D),
        ],
    },
    main_top: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::CTRL, Key::Home),
            KeyboardShortcut::new(Modifiers::CTRL, Key::T),
        ],
    },
    main_bottom: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::CTRL, Key::End),
            KeyboardShortcut::new(Modifiers::CTRL, Key::E),
        ],
    },
    search_page_up: Shortcut {
        bindings: SEARCH_PAGE_UP_BINDINGS,
    },
    search_page_down: Shortcut {
        bindings: SEARCH_PAGE_DOWN_BINDINGS,
    },
    search_top: Shortcut {
        bindings: SEARCH_TOP_BINDINGS,
    },
    search_bottom: Shortcut {
        bindings: SEARCH_BOTTOM_BINDINGS,
    },
};

struct SessionShortcuts {
    activate_search_tab: Shortcut,
    activate_filters_tab: Shortcut,
    activate_observing_tab: Shortcut,
    activate_attachments_tab: Shortcut,
    activate_bottom_search_tab: Shortcut,
    activate_details_tab: Shortcut,
    activate_library_tab: Shortcut,
    activate_presets_tab: Shortcut,
    activate_chart_tab: Shortcut,
    main_page_up: Shortcut,
    main_page_down: Shortcut,
    main_top: Shortcut,
    main_bottom: Shortcut,
    search_page_up: Shortcut,
    search_page_down: Shortcut,
    search_top: Shortcut,
    search_bottom: Shortcut,
}

pub fn handle(
    session: &mut Session,
    panels_visibility: &mut PanelsVisibility,
    ctx: &Context,
) -> bool {
    let SessionShortcuts {
        activate_search_tab,
        activate_filters_tab,
        activate_observing_tab,
        activate_attachments_tab,
        activate_bottom_search_tab,
        activate_details_tab,
        activate_library_tab,
        activate_presets_tab,
        activate_chart_tab,
        main_page_up,
        main_page_down,
        main_top,
        main_bottom,
        search_page_up,
        search_page_down,
        search_top,
        search_bottom,
    } = &SHORTCUTS;

    if consume_shortcut(ctx, activate_search_tab) {
        session.activate_search_tab(panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_filters_tab) {
        session.activate_side_tab(SideTabType::Filters, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_observing_tab) {
        session.activate_side_tab(SideTabType::Observing, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_attachments_tab) {
        session.activate_side_tab(SideTabType::Attachments, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_bottom_search_tab) {
        session.activate_bottom_tab(BottomTabType::Search, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_details_tab) {
        session.activate_bottom_tab(BottomTabType::Details, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_library_tab) {
        session.activate_bottom_tab(BottomTabType::Library, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_presets_tab) {
        session.activate_bottom_tab(BottomTabType::Presets, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, activate_chart_tab) {
        session.activate_bottom_tab(BottomTabType::Chart, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, main_page_up) {
        session.scroll_main_table(TableScroll::PageUp);
        return true;
    }

    if consume_shortcut(ctx, main_page_down) {
        session.scroll_main_table(TableScroll::PageDown);
        return true;
    }

    if consume_shortcut(ctx, main_top) {
        session.scroll_main_table(TableScroll::Top);
        return true;
    }

    if consume_shortcut(ctx, main_bottom) {
        session.scroll_main_table(TableScroll::Bottom);
        return true;
    }

    if consume_shortcut(ctx, search_page_up) {
        session.scroll_search_table(TableScroll::PageUp, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, search_page_down) {
        session.scroll_search_table(TableScroll::PageDown, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, search_top) {
        session.scroll_search_table(TableScroll::Top, panels_visibility);
        return true;
    }

    if consume_shortcut(ctx, search_bottom) {
        session.scroll_search_table(TableScroll::Bottom, panels_visibility);
        return true;
    }

    false
}

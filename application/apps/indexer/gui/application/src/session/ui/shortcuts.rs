use egui::{Context, Key, KeyboardShortcut, Modifiers};

use crate::host::ui::{
    shortcuts::{
        definitions::Shortcut,
        matching::{consume_outside_text, consume_shortcut},
        state::LastShortcutKey,
    },
    state::PanelsVisibility,
};

use super::{
    Session, bottom_panel::BottomTabType, common::log_table::table::TableScroll,
    side_panel::SideTabType,
};

const CTRL_SHIFT: Modifiers = Modifiers::CTRL.plus(Modifiers::SHIFT);

const SEARCH_PAGE_UP_BINDINGS: &[KeyboardShortcut] =
    &[KeyboardShortcut::new(CTRL_SHIFT, Key::PageUp)];

const SEARCH_PAGE_DOWN_BINDINGS: &[KeyboardShortcut] =
    &[KeyboardShortcut::new(CTRL_SHIFT, Key::PageDown)];

const SEARCH_TOP_BINDINGS: &[KeyboardShortcut] = &[KeyboardShortcut::new(CTRL_SHIFT, Key::Home)];

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

static SHORTCUTS: SessionShortcuts = SessionShortcuts {
    activate_main_output: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::Num1)],
        description: "Focus main logs table",
    },
    activate_search_output: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::Num2)],
        description: "Focus search results table",
    },
    active_page_up: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::U)],
        description: "Scroll active table one page up",
    },
    active_page_down: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::D)],
        description: "Scroll active table one page down",
    },
    active_top: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::NONE, Key::G)],
        description: "Scroll active table to top",
    },
    active_bottom: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::SHIFT, Key::G)],
        description: "Scroll active table to bottom",
    },
    activate_search_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::COMMAND, Key::F)],
        description: "Focus search",
    },
    activate_search_tab_outside_text: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::NONE, Key::Slash)],
        description: "Focus search",
    },
    activate_filters_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::F,
        )],
        description: "Open filters panel",
    },
    activate_observing_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::O,
        )],
        description: "Open observing panel",
    },
    activate_attachments_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Y,
        )],
        description: "Open attachments panel",
    },
    activate_bottom_search_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num1,
        )],
        description: "Open bottom search panel",
    },
    activate_details_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num2,
        )],
        description: "Open details panel",
    },
    activate_library_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num3,
        )],
        description: "Open library panel",
    },
    activate_presets_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num4,
        )],
        description: "Open presets panel",
    },
    activate_chart_tab: Shortcut {
        bindings: &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num5,
        )],
        description: "Open chart panel",
    },
    main_page_up: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::PageUp)],
        description: "Scroll main table one page up",
    },
    main_page_down: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::PageDown)],
        description: "Scroll main table one page down",
    },
    main_top: Shortcut {
        bindings: &[KeyboardShortcut::new(Modifiers::CTRL, Key::Home)],
        description: "Scroll main table to top",
    },
    main_bottom: Shortcut {
        bindings: &[
            KeyboardShortcut::new(Modifiers::CTRL, Key::End),
            KeyboardShortcut::new(Modifiers::CTRL, Key::E),
        ],
        description: "Scroll main table to bottom",
    },
    search_page_up: Shortcut {
        bindings: SEARCH_PAGE_UP_BINDINGS,
        description: "Scroll search results one page up",
    },
    search_page_down: Shortcut {
        bindings: SEARCH_PAGE_DOWN_BINDINGS,
        description: "Scroll search results one page down",
    },
    search_top: Shortcut {
        bindings: SEARCH_TOP_BINDINGS,
        description: "Scroll search results to top",
    },
    search_bottom: Shortcut {
        bindings: SEARCH_BOTTOM_BINDINGS,
        description: "Scroll search results to bottom",
    },
};

struct SessionShortcuts {
    activate_main_output: Shortcut,
    activate_search_output: Shortcut,
    active_page_up: Shortcut,
    active_page_down: Shortcut,
    active_top: Shortcut,
    active_bottom: Shortcut,
    activate_search_tab: Shortcut,
    activate_search_tab_outside_text: Shortcut,
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

pub fn shortcut_defs() -> [&'static Shortcut; 23] {
    let SessionShortcuts {
        activate_main_output,
        activate_search_output,
        active_page_up,
        active_page_down,
        active_top: _,
        active_bottom,
        activate_search_tab,
        activate_search_tab_outside_text,
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

    [
        activate_main_output,
        activate_search_output,
        active_page_up,
        active_page_down,
        active_bottom,
        activate_search_tab,
        activate_search_tab_outside_text,
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
    ]
}

pub fn handle(
    session: &mut Session,
    panels_visibility: &mut PanelsVisibility,
    ctx: &Context,
    last_key: Option<&LastShortcutKey>,
) -> bool {
    let SessionShortcuts {
        activate_main_output,
        activate_search_output,
        active_page_up,
        active_page_down,
        active_top,
        active_bottom,
        activate_search_tab,
        activate_search_tab_outside_text,
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

    if consume_shortcut(ctx, activate_main_output) {
        session.activate_main_logs_table(ctx);
        return true;
    }

    if consume_shortcut(ctx, activate_search_output) {
        session.activate_search_results_table(panels_visibility, ctx);
        return true;
    }

    if consume_shortcut(ctx, active_page_up) {
        session.scroll_active_table(TableScroll::PageUp, panels_visibility, ctx);
        return true;
    }

    if consume_shortcut(ctx, active_page_down) {
        session.scroll_active_table(TableScroll::PageDown, panels_visibility, ctx);
        return true;
    }

    // Scroll to top with `gg`.
    if last_key.is_some_and(|last_key| last_key.matches_key(Modifiers::NONE, Key::G))
        && consume_outside_text(ctx, active_top)
    {
        session.scroll_active_table(TableScroll::Top, panels_visibility, ctx);
        return true;
    }

    if consume_outside_text(ctx, active_bottom) {
        session.scroll_active_table(TableScroll::Bottom, panels_visibility, ctx);
        return true;
    }

    if consume_shortcut(ctx, activate_search_tab)
        || consume_outside_text(ctx, activate_search_tab_outside_text)
    {
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

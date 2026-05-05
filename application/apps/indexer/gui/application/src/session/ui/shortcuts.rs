use egui::{Context, Key, KeyboardShortcut, Modifiers};

use session_core::state::IndexedNavigation;

use crate::{
    host::ui::{
        UiActions,
        shortcuts::{
            definitions::{Shortcut, ShortcutDisplay},
            matching::{consume_outside_text, consume_shortcut},
            state::LastShortcutKey,
        },
        state::PanelsVisibility,
    },
    session::command::SessionCommand,
};

use super::{
    Session, bottom_panel::BottomTabType, common::log_table::table::TableScroll,
    shared::BookmarkNavigation, side_panel::SideTabType,
};

const ACTIVE_PAGE_UP_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(Modifiers::CTRL, Key::U),
    KeyboardShortcut::new(Modifiers::CTRL, Key::PageUp),
];

const ACTIVE_PAGE_DOWN_BINDINGS: &[KeyboardShortcut] = &[
    KeyboardShortcut::new(Modifiers::CTRL, Key::D),
    KeyboardShortcut::new(Modifiers::CTRL, Key::PageDown),
];

const ACTIVE_TOP_DIRECT_BINDINGS: &[KeyboardShortcut] =
    &[KeyboardShortcut::new(Modifiers::CTRL, Key::Home)];

const ACTIVE_BOTTOM_DIRECT_BINDINGS: &[KeyboardShortcut] =
    &[KeyboardShortcut::new(Modifiers::CTRL, Key::End)];

#[cfg(target_os = "macos")]
const ACTIVE_TOP_DISPLAY: &str = "gg / Cmd+Home";
#[cfg(not(target_os = "macos"))]
const ACTIVE_TOP_DISPLAY: &str = "gg / Ctrl+Home";

#[cfg(target_os = "macos")]
const ACTIVE_BOTTOM_DISPLAY: &str = "Shift+G / Cmd+End";
#[cfg(not(target_os = "macos"))]
const ACTIVE_BOTTOM_DISPLAY: &str = "Shift+G / Ctrl+End";

#[cfg(target_os = "macos")]
const SEARCH_FOCUS_DISPLAY: &str = "Slash / Cmd+F";
#[cfg(not(target_os = "macos"))]
const SEARCH_FOCUS_DISPLAY: &str = "Slash / Ctrl+F";

static SHORTCUTS: SessionShortcuts = SessionShortcuts {
    activate_main_output: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::CTRL, Key::Num1)],
        "Focus main logs table",
    ),
    activate_search_output: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::CTRL, Key::Num2)],
        "Focus search results table",
    ),
    active_page_up: Shortcut::new(ACTIVE_PAGE_UP_BINDINGS, "Scroll active table one page up"),
    active_page_down: Shortcut::new(
        ACTIVE_PAGE_DOWN_BINDINGS,
        "Scroll active table one page down",
    ),
    active_top: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::NONE, Key::G)],
        "Scroll active table to top",
    ),
    active_top_direct: Shortcut::new(ACTIVE_TOP_DIRECT_BINDINGS, "Scroll active table to top")
        .with_display(ShortcutDisplay::OverrideText(ACTIVE_TOP_DISPLAY)),
    active_bottom: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::SHIFT, Key::G)],
        "Scroll active table to bottom",
    )
    .with_display(ShortcutDisplay::OverrideText(ACTIVE_BOTTOM_DISPLAY)),
    active_bottom_direct: Shortcut::new(
        ACTIVE_BOTTOM_DIRECT_BINDINGS,
        "Scroll active table to bottom",
    )
    .with_display(ShortcutDisplay::Skip),
    activate_search_tab: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::COMMAND, Key::F)],
        "Focus search",
    )
    .with_display(ShortcutDisplay::OverrideText(SEARCH_FOCUS_DISPLAY)),
    activate_search_tab_outside_text: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::NONE, Key::Slash)],
        "Focus search",
    )
    .with_display(ShortcutDisplay::Skip),
    activate_filters_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::F,
        )],
        "Open filters panel",
    ),
    activate_observing_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::O,
        )],
        "Open observing panel",
    ),
    activate_attachments_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Y,
        )],
        "Open attachments panel",
    ),
    activate_bottom_search_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num1,
        )],
        "Open bottom search panel",
    ),
    activate_details_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num2,
        )],
        "Open details panel",
    ),
    activate_library_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num3,
        )],
        "Open library panel",
    ),
    activate_presets_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num4,
        )],
        "Open presets panel",
    ),
    activate_chart_tab: Shortcut::new(
        &[KeyboardShortcut::new(
            Modifiers::COMMAND.plus(Modifiers::SHIFT),
            Key::Num5,
        )],
        "Open chart panel",
    ),
    previous_indexed_row: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::NONE, Key::OpenBracket)],
        "Select previous indexed row",
    ),
    next_indexed_row: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::NONE, Key::CloseBracket)],
        "Select next indexed row",
    ),
    next_bookmark: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::NONE, Key::J)],
        "Select next bookmarked row",
    ),
    previous_bookmark: Shortcut::new(
        &[KeyboardShortcut::new(Modifiers::NONE, Key::K)],
        "Select previous bookmarked row",
    ),
};

struct SessionShortcuts {
    activate_main_output: Shortcut,
    activate_search_output: Shortcut,
    active_page_up: Shortcut,
    active_page_down: Shortcut,
    active_top: Shortcut,
    active_top_direct: Shortcut,
    active_bottom: Shortcut,
    active_bottom_direct: Shortcut,
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
    previous_indexed_row: Shortcut,
    next_indexed_row: Shortcut,
    next_bookmark: Shortcut,
    previous_bookmark: Shortcut,
}

pub fn shortcut_defs() -> [&'static Shortcut; 21] {
    let SessionShortcuts {
        activate_main_output,
        activate_search_output,
        active_page_up,
        active_page_down,
        active_top: _,
        active_top_direct,
        active_bottom,
        active_bottom_direct,
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
        previous_indexed_row,
        next_indexed_row,
        next_bookmark,
        previous_bookmark,
    } = &SHORTCUTS;

    [
        activate_search_tab,
        activate_search_tab_outside_text,
        activate_main_output,
        activate_search_output,
        active_page_up,
        active_page_down,
        active_top_direct,
        active_bottom,
        active_bottom_direct,
        previous_indexed_row,
        next_indexed_row,
        next_bookmark,
        previous_bookmark,
        activate_filters_tab,
        activate_observing_tab,
        activate_attachments_tab,
        activate_bottom_search_tab,
        activate_details_tab,
        activate_library_tab,
        activate_presets_tab,
        activate_chart_tab,
    ]
}

pub fn handle(
    session: &mut Session,
    actions: &mut UiActions,
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
        active_top_direct,
        active_bottom,
        active_bottom_direct,
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
        previous_indexed_row,
        next_indexed_row,
        next_bookmark,
        previous_bookmark,
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

    if consume_shortcut(ctx, active_top_direct) {
        session.scroll_active_table(TableScroll::Top, panels_visibility, ctx);
        return true;
    }

    if consume_outside_text(ctx, active_bottom) || consume_shortcut(ctx, active_bottom_direct) {
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

    if consume_outside_text(ctx, previous_indexed_row) {
        let anchor = session.shared.logs.single_selected_row().unwrap_or(0);
        actions.try_send_command(
            &session.cmd_tx,
            SessionCommand::GetIndexedNeighbor {
                anchor,
                direction: IndexedNavigation::Previous,
            },
        );
        return true;
    }

    if consume_outside_text(ctx, next_indexed_row) {
        let anchor = session.shared.logs.single_selected_row().unwrap_or(0);
        actions.try_send_command(
            &session.cmd_tx,
            SessionCommand::GetIndexedNeighbor {
                anchor,
                direction: IndexedNavigation::Next,
            },
        );
        return true;
    }

    if consume_outside_text(ctx, next_bookmark) {
        session
            .shared
            .logs
            .focus_bookmark_neighbor(BookmarkNavigation::Next);
        return true;
    }

    if consume_outside_text(ctx, previous_bookmark) {
        session
            .shared
            .logs
            .focus_bookmark_neighbor(BookmarkNavigation::Previous);
        return true;
    }

    false
}

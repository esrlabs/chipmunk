//! Static command list and command-palette actions.

use egui::{Theme, Ui};
use stypes::FileFormat;
use tokio::sync::mpsc::Sender;

use crate::{
    common::{matcher::fuzzy_matcher::FuzzyMatcher, ui::search_picker::SearchPickerText},
    host::{
        command::HostCommand,
        common::{parsers::ParserNames, sources::StreamNames},
        ui::{
            UiActions, file_dialog_commands,
            state::{HostState, modal::HostModal},
            storage::HostStorage,
            tabs::HostTabs,
        },
    },
};

use super::CommandPaletteItem;

/// Host-level action launched from a command-palette result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandAction {
    GoHome,
    OpenFiles,
    OpenFilesWithPlugin,
    OpenFolderFiles(FileFormat),
    CloseCurrentTab,
    NextTab,
    PreviousTab,
    OpenPluginManager,
    OpenSettings,
    ReloadPlugins,
    ShowShortcuts,
    ShowAbout,
    SetTheme(Theme),
    ToggleRightPanel,
    ToggleBottomPanel,
    ConnectionSetup {
        stream: StreamNames,
        parser: ParserNames,
    },
}

/// Static command-palette entry.
#[derive(Debug, Clone, Copy)]
pub struct CommandDefinition {
    /// Searchable command title shown in the palette.
    pub title: &'static str,
    /// Action executed when this command is selected.
    pub action: CommandAction,
}

const COMMANDS: &[CommandDefinition] = &[
    CommandDefinition {
        title: "Go to Home",
        action: CommandAction::GoHome,
    },
    CommandDefinition {
        title: "Open File(s)",
        action: CommandAction::OpenFiles,
    },
    CommandDefinition {
        title: "Open File(s) with Plugin",
        action: CommandAction::OpenFilesWithPlugin,
    },
    CommandDefinition {
        title: "Open Text Files from Folder",
        action: CommandAction::OpenFolderFiles(FileFormat::Text),
    },
    CommandDefinition {
        title: "Open DLT Binary Files from Folder",
        action: CommandAction::OpenFolderFiles(FileFormat::Binary),
    },
    CommandDefinition {
        title: "Open PcapNG Files from Folder",
        action: CommandAction::OpenFolderFiles(FileFormat::PcapNG),
    },
    CommandDefinition {
        title: "Open Pcap Files from Folder",
        action: CommandAction::OpenFolderFiles(FileFormat::PcapLegacy),
    },
    CommandDefinition {
        title: "Close Current Tab",
        action: CommandAction::CloseCurrentTab,
    },
    CommandDefinition {
        title: "Next Tab",
        action: CommandAction::NextTab,
    },
    CommandDefinition {
        title: "Previous Tab",
        action: CommandAction::PreviousTab,
    },
    CommandDefinition {
        title: "Open Plugin Manager",
        action: CommandAction::OpenPluginManager,
    },
    CommandDefinition {
        title: "Open Settings",
        action: CommandAction::OpenSettings,
    },
    CommandDefinition {
        title: "Reload Plugins",
        action: CommandAction::ReloadPlugins,
    },
    CommandDefinition {
        title: "Show Keyboard Shortcuts",
        action: CommandAction::ShowShortcuts,
    },
    CommandDefinition {
        title: "Show About",
        action: CommandAction::ShowAbout,
    },
    CommandDefinition {
        title: "Set Dark Theme",
        action: CommandAction::SetTheme(Theme::Dark),
    },
    CommandDefinition {
        title: "Set Light Theme",
        action: CommandAction::SetTheme(Theme::Light),
    },
    CommandDefinition {
        title: "Toggle Right Panel",
        action: CommandAction::ToggleRightPanel,
    },
    CommandDefinition {
        title: "Toggle Bottom Panel",
        action: CommandAction::ToggleBottomPanel,
    },
    CommandDefinition {
        title: "Terminal with Plain Text",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Process,
            parser: ParserNames::Text,
        },
    },
    CommandDefinition {
        title: "Serial Port with Plain Text",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Serial,
            parser: ParserNames::Text,
        },
    },
    CommandDefinition {
        title: "TCP with DLT",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Tcp,
            parser: ParserNames::Dlt,
        },
    },
    CommandDefinition {
        title: "UDP with DLT",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Udp,
            parser: ParserNames::Dlt,
        },
    },
    CommandDefinition {
        title: "Serial Port with DLT",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Serial,
            parser: ParserNames::Dlt,
        },
    },
    CommandDefinition {
        title: "TCP with SomeIP",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Tcp,
            parser: ParserNames::SomeIP,
        },
    },
    CommandDefinition {
        title: "UDP with SomeIP",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Udp,
            parser: ParserNames::SomeIP,
        },
    },
    CommandDefinition {
        title: "Serial Port with SomeIP",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Serial,
            parser: ParserNames::SomeIP,
        },
    },
    CommandDefinition {
        title: "Terminal with Plugin",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Process,
            parser: ParserNames::Plugins,
        },
    },
    CommandDefinition {
        title: "TCP with Plugin",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Tcp,
            parser: ParserNames::Plugins,
        },
    },
    CommandDefinition {
        title: "UDP with Plugin",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Udp,
            parser: ParserNames::Plugins,
        },
    },
    CommandDefinition {
        title: "Serial Port with Plugin",
        action: CommandAction::ConnectionSetup {
            stream: StreamNames::Serial,
            parser: ParserNames::Plugins,
        },
    },
];

/// Rebuilds command-palette results from the static command list.
pub fn recompute_results(matcher: &mut FuzzyMatcher) -> Vec<CommandPaletteItem> {
    let mut matches: Vec<_> = COMMANDS
        .iter()
        .enumerate()
        .filter_map(|(index, command)| {
            matcher
                .score(command.title)
                .map(|score| (index, score, command))
        })
        .collect();

    matches.sort_by(
        |(left_index, left_score, _), (right_index, right_score, _)| {
            right_score
                .cmp(left_score)
                .then_with(|| left_index.cmp(right_index))
        },
    );

    matches
        .into_iter()
        .map(|(_, _, command)| CommandPaletteItem {
            title: SearchPickerText::new(command.title, matcher.highlight_ranges(command.title)),
            action: command.action,
        })
        .collect()
}

/// Executes a command-palette action and returns whether the palette should close.
pub fn execute_action(
    action: CommandAction,
    cmd_tx: &Sender<HostCommand>,
    state: &mut HostState,
    tabs: &mut HostTabs,
    storage: &HostStorage,
    actions: &mut UiActions,
    ui: &Ui,
) -> bool {
    match action {
        CommandAction::GoHome => {
            tabs.activate_home();
            true
        }
        CommandAction::OpenFiles => {
            file_dialog_commands::open_files_dialog(actions);
            true
        }
        CommandAction::OpenFilesWithPlugin => {
            file_dialog_commands::open_files_with_plugin_dialog(actions);
            true
        }
        CommandAction::OpenFolderFiles(format) => {
            file_dialog_commands::open_folder_dialog(actions, format);
            true
        }
        CommandAction::CloseCurrentTab => {
            tabs.close_active_tab(&mut state.registry, &mut state.modals, actions);
            true
        }
        CommandAction::NextTab => {
            tabs.activate_next_tab();
            true
        }
        CommandAction::PreviousTab => {
            tabs.activate_previous_tab();
            true
        }
        CommandAction::OpenPluginManager => {
            tabs.open_plugin_manager();
            true
        }
        CommandAction::OpenSettings => {
            tabs.open_app_settings(storage.settings.current().clone());
            true
        }
        CommandAction::ReloadPlugins => {
            actions.try_send_command(cmd_tx, HostCommand::ReloadPlugins)
        }
        CommandAction::ShowShortcuts => {
            state.modals.open(HostModal::Shortcuts);
            true
        }
        CommandAction::ShowAbout => {
            state.modals.open(HostModal::About);
            true
        }
        CommandAction::SetTheme(theme) => {
            ui.ctx().set_theme(theme);
            true
        }
        CommandAction::ToggleRightPanel => {
            let visible = &mut state.preferences.panels_visibility.right;
            *visible = !*visible;
            true
        }
        CommandAction::ToggleBottomPanel => {
            let visible = &mut state.preferences.panels_visibility.bottom;
            *visible = !*visible;
            true
        }
        CommandAction::ConnectionSetup { stream, parser } => actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup { stream, parser },
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_matcher(query: &str) -> FuzzyMatcher {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query(query);
        matcher
    }

    fn result_actions(results: &[CommandPaletteItem]) -> Vec<CommandAction> {
        results.iter().map(|item| item.action).collect()
    }

    #[test]
    fn empty_query_preserves_command_order() {
        let mut matcher = build_matcher("");

        let results = recompute_results(&mut matcher);

        assert_eq!(results.len(), COMMANDS.len());
        let expected: Vec<_> = COMMANDS[..3].iter().map(|command| command.action).collect();
        assert_eq!(&result_actions(&results)[..3], expected.as_slice());
        assert!(results.iter().all(|item| item.title.highlights.is_empty()));
    }

    #[test]
    fn fuzzy_query_matches_titles_only_and_highlights_title() {
        let mut matcher = build_matcher("pm");

        let results = recompute_results(&mut matcher);

        assert!(result_actions(&results).contains(&CommandAction::OpenPluginManager));
        assert!(!result_actions(&results).contains(&CommandAction::ReloadPlugins));

        let plugin_manager = results
            .iter()
            .find(|item| item.action == CommandAction::OpenPluginManager)
            .expect("plugin manager command should match");
        assert!(!plugin_manager.title.highlights.is_empty());
    }
}

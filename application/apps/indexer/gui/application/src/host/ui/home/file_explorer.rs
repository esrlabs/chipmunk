//! Favorite-folders UI for the home screen.
//!
//! This module renders the home-screen file explorer, manages its transient UI
//! state, and bridges user actions to the host/storage layers.

use std::{hash::Hash, ops::Not, path::PathBuf};

use egui::{Align, Layout, TextStyle};
use egui::{
    Button, Label, Response, RichText, Sense, Ui, UiBuilder, Widget,
    collapsing_header::CollapsingState, vec2,
};
use tokio::sync::mpsc::Sender;

use crate::common::{phosphor::icons, ui::substring_matcher::SubstringMatcher};
use crate::host::common::ui_utls::{sized_singleline_text_edit, truncate_path_to_width};
use crate::host::{
    command::{HostCommand, ScanFavoriteFoldersParam},
    ui::{
        UiActions,
        actions::FileDialogOptions,
        storage::{
            FavoriteFolder, FavoriteFoldersScanRequest, FileExplorerStorage, FileTreeNode,
            FileTreeNodeKind, LoadState,
        },
    },
};

const FAVORITES_FOLDER_ID: &str = "favorites_folder";
const CONTROL_ROW_HEIGHT: f32 = 25.0;

/// Home-screen favorite-folder tree UI state and command bridge.
#[derive(Debug)]
pub struct FileExplorerUi {
    /// Host command channel used for file opens and favorite-folder scans.
    cmd_tx: Sender<HostCommand>,
    /// Current favorite-file search text entered by the user.
    search_query: String,
    /// Reusable matcher compiled from `search_query` when the query changes.
    search_matcher: SubstringMatcher,
    /// Filtered favorite-tree snapshot derived from the latest storage revision.
    search_cache: FavoriteSearchCache,
}

/// Cached favorite-file search results and their invalidation keys.
#[derive(Debug, Default)]
struct FavoriteSearchCache {
    /// Search text used to build `roots`.
    query: String,
    /// File-explorer storage revision used to build `roots`.
    revision: u64,
    /// Filtered favorite roots for the cached query and revision.
    roots: Option<Vec<FavoriteFolder>>,
}

impl FileExplorerUi {
    /// Creates the home-screen file-explorer UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            cmd_tx,
            search_query: String::new(),
            search_matcher: SubstringMatcher::default(),
            search_cache: FavoriteSearchCache::default(),
        }
    }

    /// Renders the favorite-folders panel and applies user actions to the
    /// file-explorer storage domain.
    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        file_explorer: &mut FileExplorerStorage,
        ui: &mut Ui,
    ) {
        let busy_label = favorite_folders_busy_label(file_explorer);
        let busy = busy_label.is_some();

        ui.add_space(5.0);
        Label::new(RichText::new("Favorite folders").heading())
            .truncate()
            .ui(ui);

        if let Some(selected_paths) = actions.file_dialog.take_output(FAVORITES_FOLDER_ID) {
            let new_paths: Vec<PathBuf> = selected_paths
                .into_iter()
                .filter(|path| !file_explorer.contains_favorite_folder(path))
                .collect();

            if !new_paths.is_empty() {
                let mut scan_paths = match &file_explorer.state {
                    LoadState::Ready(data) => data
                        .favorite_folders
                        .iter()
                        .map(|folder| folder.path.clone())
                        .collect(),
                    LoadState::Loading => Vec::new(),
                };

                for path in new_paths {
                    if !scan_paths.iter().any(|existing| existing == &path) {
                        scan_paths.push(path);
                    }
                }

                if let Some(request) = file_explorer.prepare_add_scan(scan_paths) {
                    self.send_favorite_folder_scan(actions, file_explorer, request);
                }
            }
        }

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), CONTROL_ROW_HEIGHT),
            Layout::right_to_left(Align::Center),
            |ui| {
                let icon_size = 15.0;

                ui.style_mut().spacing.item_spacing.x = 2.0;

                if ui
                    .add_enabled(
                        !busy,
                        Button::new(RichText::new(icons::regular::FOLDER_PLUS).size(icon_size))
                            .frame(true)
                            .frame_when_inactive(false),
                    )
                    .on_hover_text("Add folder")
                    .clicked()
                {
                    actions.file_dialog.pick_folder(
                        FAVORITES_FOLDER_ID,
                        FileDialogOptions::new().title("Select Favorites Folder"),
                    );
                }

                if ui
                    .add_enabled(
                        !busy,
                        Button::new(
                            RichText::new(icons::regular::ARROWS_CLOCKWISE).size(icon_size),
                        )
                        .frame(true)
                        .frame_when_inactive(false),
                    )
                    .on_hover_text("Refresh")
                    .clicked()
                {
                    let paths = match &file_explorer.state {
                        LoadState::Ready(data) => data
                            .favorite_folders
                            .iter()
                            .map(|folder| folder.path.clone())
                            .collect(),
                        LoadState::Loading => Vec::new(),
                    };

                    if let Some(request) = file_explorer.prepare_scan(paths) {
                        self.send_favorite_folder_scan(actions, file_explorer, request);
                    }
                }

                let search_response = sized_singleline_text_edit(
                    ui,
                    &mut self.search_query,
                    vec2(ui.available_width(), CONTROL_ROW_HEIGHT),
                    7,
                )
                .hint_text("Search files")
                .ui(ui);

                if search_response.changed() {
                    self.search_matcher.build_query(&self.search_query);
                    self.search_cache.roots = None;
                }
            },
        );

        ui.add_space(2.0);

        if let Some(label) = busy_label
            && matches!(file_explorer.state, LoadState::Ready(_))
        {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(label);
            });
            ui.add_space(6.0);
        }

        self.refresh_search_cache(file_explorer);

        egui::ScrollArea::vertical()
            .id_salt("favorite_folders_scroll")
            .show(ui, |ui| {
                let LoadState::Ready(data) = &file_explorer.state else {
                    ui.vertical_centered(|ui| {
                        ui.add_space(12.0);
                        ui.spinner();
                        ui.add_space(8.0);
                        ui.label("Loading favorite folders...");
                    });
                    return;
                };

                let search_active = !self.search_query.is_empty();

                let mut remove_path = None;

                let favorite_folders = if search_active {
                    self.search_cache.roots.as_deref().unwrap_or(&[])
                } else {
                    data.favorite_folders.as_slice()
                };

                if search_active && favorite_folders.is_empty() {
                    ui.label("No favorite files match the current search.");
                }

                for folder in favorite_folders {
                    self.render_favorite_folder(
                        ui,
                        actions,
                        folder,
                        busy,
                        search_active,
                        &mut remove_path,
                    );
                }

                if let Some(path) = remove_path {
                    file_explorer.remove_favorite_folder(&path);
                }
            });
    }

    fn render_favorite_folder(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        folder: &FavoriteFolder,
        busy: bool,
        force_expanded: bool,
        remove_path: &mut Option<PathBuf>,
    ) {
        let (header_response, mut folder_state) = render_folder_header(
            ui,
            ("favorite_folder", &folder.path),
            force_expanded,
            |ui, text_color| {
                let folder_label =
                    truncate_path_to_width(ui, &folder.path, ui.available_width(), TextStyle::Body);
                let response = Label::new(RichText::new(&folder_label.text).color(text_color))
                    .truncate()
                    .show_tooltip_when_elided(false)
                    .ui(ui);
                if folder_label.truncated {
                    response.on_hover_ui(|ui| {
                        ui.set_max_width(ui.spacing().tooltip_width);
                        ui.label(folder.path.to_string_lossy());
                    });
                }
            },
        );

        header_response.context_menu(|ui| {
            if ui
                .add_enabled(!busy, Button::new("Remove from favorite folders"))
                .clicked()
            {
                *remove_path = Some(folder.path.clone());
                ui.close();
            }
        });

        if force_expanded {
            ui.indent(("favorite_folder_search_body", &folder.path), |ui| {
                self.render_tree_nodes(ui, actions, &folder.children, busy, force_expanded);
            });
        } else if let Some(folder_state) = &mut folder_state {
            folder_state.show_body_indented(&header_response, ui, |ui| {
                self.render_tree_nodes(ui, actions, &folder.children, busy, force_expanded);
            });
        }
    }

    fn render_tree_nodes(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        nodes: &[FileTreeNode],
        busy: bool,
        force_expanded: bool,
    ) {
        for node in nodes {
            match &node.kind {
                FileTreeNodeKind::Folder(children) => {
                    self.render_folder_node(ui, actions, node, children, busy, force_expanded);
                }
                FileTreeNodeKind::File => {
                    self.render_file_entry(ui, actions, node, busy);
                }
            }
        }
    }

    fn render_folder_node(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        node: &FileTreeNode,
        children: &[FileTreeNode],
        busy: bool,
        force_expanded: bool,
    ) {
        let (header_response, mut folder_state) = render_folder_header(
            ui,
            ("favorite_tree_folder", &node.path),
            force_expanded,
            |ui, text_color| {
                let response = Label::new(RichText::new(node.name.as_str()).color(text_color))
                    .truncate()
                    .ui(ui);
                response.on_hover_ui(|ui| {
                    ui.set_max_width(ui.spacing().tooltip_width);
                    ui.label(node.path.to_string_lossy());
                });
            },
        );

        if force_expanded {
            ui.indent(("favorite_tree_folder_search_body", &node.path), |ui| {
                self.render_tree_nodes(ui, actions, children, busy, force_expanded);
            });
        } else if let Some(folder_state) = &mut folder_state {
            folder_state.show_body_indented(&header_response, ui, |ui| {
                self.render_tree_nodes(ui, actions, children, busy, force_expanded);
            });
        }
    }

    fn render_file_entry(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        node: &FileTreeNode,
        busy: bool,
    ) -> Response {
        const ROW_HEIGHT: f32 = 24.0;
        const HORIZONTAL_PADDING: f32 = 8.0;
        const VERTICAL_PADDING: f32 = 4.0;

        let sense = if busy { Sense::hover() } else { Sense::click() };
        let (rect, response) =
            ui.allocate_exact_size(vec2(ui.available_width(), ROW_HEIGHT), sense);

        if response.hovered() || response.is_pointer_button_down_on() {
            ui.painter()
                .rect_filled(rect, 0.0, ui.visuals().widgets.hovered.bg_fill);
        }

        let inner_rect = rect.shrink2(vec2(HORIZONTAL_PADDING, VERTICAL_PADDING));
        ui.scope_builder(UiBuilder::new().max_rect(inner_rect), |ui| {
            Label::new(node.name.as_str()).truncate().ui(ui);
        });

        let response = if busy {
            response
        } else {
            response.on_hover_cursor(egui::CursorIcon::PointingHand)
        };
        let response = response.on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            ui.label(node.path.to_string_lossy());
        });

        response.context_menu(|ui| {
            if ui.add_enabled(!busy, Button::new("Open File")).clicked() {
                self.open_favorite_file(actions, node.path.clone());
                ui.close();
            }
        });

        if !busy && response.clicked() {
            self.open_favorite_file(actions, node.path.clone());
        }

        response
    }

    /// Sends one favorite-folder scan request to the host service and clears
    /// the pending UI-side request if the command cannot be queued.
    fn send_favorite_folder_scan(
        &self,
        actions: &mut UiActions,
        file_explorer: &mut FileExplorerStorage,
        request: FavoriteFoldersScanRequest,
    ) {
        let cmd = HostCommand::ScanFavoriteFolders(Box::new(ScanFavoriteFoldersParam {
            request_id: request.request_id,
            paths: request.paths,
        }));

        if !actions.try_send_command(&self.cmd_tx, cmd) {
            file_explorer.clear_active_scan_request();
        }
    }

    fn open_favorite_file(&self, actions: &mut UiActions, path: PathBuf) {
        actions.try_send_command(&self.cmd_tx, HostCommand::OpenFiles(vec![path]));
    }

    /// Refreshes the cached favorite-file search result when its invalidation keys change.
    ///
    /// Empty search text clears the cache. Non-empty searches rebuild only when the query or
    /// `FileExplorerStorage::revision` differs from the cached values.
    fn refresh_search_cache(&mut self, file_explorer: &FileExplorerStorage) {
        if self.search_query.is_empty() {
            self.search_cache.roots = None;
            return;
        }

        if self.search_cache.roots.is_some()
            && self.search_cache.query == self.search_query
            && self.search_cache.revision == file_explorer.revision
        {
            return;
        }

        self.search_matcher.build_query(&self.search_query);
        let roots = match &file_explorer.state {
            LoadState::Ready(data) => {
                filter_favorite_folders(&data.favorite_folders, &mut self.search_matcher)
            }
            LoadState::Loading => Vec::new(),
        };

        self.search_cache.query.clone_from(&self.search_query);
        self.search_cache.revision = file_explorer.revision;
        self.search_cache.roots = Some(roots);
    }
}

/// Renders a favorite-tree folder header row.
///
/// The returned response is the clickable header row. The returned collapsing
/// state is `None` when `force_expanded` is true, because search results are
/// rendered expanded without mutating normal egui expansion state.
///
/// # Arguments
///
/// * `ui` - Target egui UI.
/// * `id_salt` - Stable id salt for the persisted folder expansion state.
/// * `force_expanded` - Whether to render the folder as open without loading or updating persisted expansion state.
/// * `render_label` - Renders the caller-specific label after the caret icon, using the provided text color.
fn render_folder_header(
    ui: &mut Ui,
    id_salt: impl Hash,
    force_expanded: bool,
    render_label: impl FnOnce(&mut Ui, egui::Color32),
) -> (Response, Option<CollapsingState>) {
    let folder_id = ui.make_persistent_id(id_salt);
    let mut folder_state = force_expanded
        .not()
        .then(|| CollapsingState::load_with_default_open(ui.ctx(), folder_id, false));

    let (rect, mut header_response) = ui.allocate_exact_size(
        vec2(ui.available_width(), ui.spacing().interact_size.y),
        Sense::click(),
    );

    if header_response.clicked()
        && let Some(folder_state) = &mut folder_state
    {
        folder_state.toggle(ui);
        header_response.mark_changed();
    }

    let visuals = ui.style().interact_selectable(&header_response, false);
    let text_color = visuals.text_color();
    let icon = if force_expanded
        || folder_state
            .as_ref()
            .is_some_and(|folder_state| folder_state.is_open())
    {
        icons::regular::CARET_DOWN
    } else {
        icons::regular::CARET_RIGHT
    };

    ui.scope_builder(
        UiBuilder::new()
            .max_rect(rect.shrink2(ui.spacing().button_padding))
            .layout(Layout::left_to_right(Align::Center)),
        |ui| {
            ui.style_mut().spacing.item_spacing.x = 4.0;
            ui.label(RichText::new(icon).size(14.0).color(text_color));
            render_label(ui, text_color);
        },
    );

    (header_response, folder_state)
}

fn filter_favorite_folders(
    favorite_folders: &[FavoriteFolder],
    matcher: &mut SubstringMatcher,
) -> Vec<FavoriteFolder> {
    favorite_folders
        .iter()
        .filter_map(|folder| {
            let children = filter_tree_nodes(&folder.children, matcher);
            children.is_empty().not().then(|| FavoriteFolder {
                path: folder.path.clone(),
                children,
            })
        })
        .collect()
}

fn filter_tree_nodes(nodes: &[FileTreeNode], matcher: &mut SubstringMatcher) -> Vec<FileTreeNode> {
    nodes
        .iter()
        .filter_map(|node| match &node.kind {
            FileTreeNodeKind::Folder(children) => {
                let children = filter_tree_nodes(children, matcher);
                children.is_empty().not().then(|| FileTreeNode {
                    path: node.path.clone(),
                    name: node.name.clone(),
                    kind: FileTreeNodeKind::Folder(children),
                })
            }
            FileTreeNodeKind::File => matcher.matches(node.name.as_str()).then(|| node.clone()),
        })
        .collect()
}

fn favorite_folders_busy_label(file_explorer: &FileExplorerStorage) -> Option<&'static str> {
    if matches!(file_explorer.state, LoadState::Loading) {
        Some("Loading favorite folders")
    } else if file_explorer.active_scan_request_id.is_some() {
        Some("Scanning favorite folders")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{
        FavoriteFolder, FileExplorerUi, FileTreeNode, FileTreeNodeKind, LoadState,
        filter_favorite_folders,
    };
    use crate::{
        common::ui::substring_matcher::SubstringMatcher,
        host::ui::storage::{FileExplorerData, FileExplorerStorage},
    };

    fn build_matcher(query: &str) -> SubstringMatcher {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query(query);
        matcher
    }

    fn file_node(path: &str, name: &str) -> FileTreeNode {
        FileTreeNode {
            path: PathBuf::from(path),
            name: name.into(),
            kind: FileTreeNodeKind::File,
        }
    }

    fn folder_node(path: &str, name: &str, children: Vec<FileTreeNode>) -> FileTreeNode {
        FileTreeNode {
            path: PathBuf::from(path),
            name: name.into(),
            kind: FileTreeNodeKind::Folder(children),
        }
    }

    fn favorite_folder(path: &str, children: Vec<FileTreeNode>) -> FavoriteFolder {
        FavoriteFolder {
            path: PathBuf::from(path),
            children,
        }
    }

    fn child_names(nodes: &[FileTreeNode]) -> Vec<&str> {
        nodes.iter().map(|node| node.name.as_str()).collect()
    }

    fn folder_children<'a>(nodes: &'a [FileTreeNode], name: &str) -> &'a [FileTreeNode] {
        let node = nodes
            .iter()
            .find(|node| node.name == name)
            .unwrap_or_else(|| panic!("folder {name} should exist"));

        let FileTreeNodeKind::Folder(children) = &node.kind else {
            panic!("{name} should be a folder");
        };

        children
    }

    fn file_explorer_ui(query: &str) -> FileExplorerUi {
        let (cmd_tx, _cmd_rx) = tokio::sync::mpsc::channel(1);
        let mut ui = FileExplorerUi::new(cmd_tx);
        ui.search_query = query.into();
        ui.search_matcher.build_query(query);
        ui
    }

    fn storage_with(favorite_folders: Vec<FavoriteFolder>, revision: u64) -> FileExplorerStorage {
        let mut storage = FileExplorerStorage::new();
        storage.state = LoadState::Ready(FileExplorerData { favorite_folders });
        storage.revision = revision;
        storage
    }

    #[test]
    fn search_keeps_matching_file_ancestors_and_omits_siblings() {
        let root = favorite_folder(
            "/root",
            vec![
                folder_node(
                    "/root/logs",
                    "logs",
                    vec![
                        file_node("/root/logs/target.log", "target.log"),
                        file_node("/root/logs/other.log", "other.log"),
                    ],
                ),
                folder_node(
                    "/root/target-folder",
                    "target-folder",
                    vec![file_node("/root/target-folder/other.log", "other.log")],
                ),
                file_node("/root/top.log", "top.log"),
            ],
        );

        let filtered = filter_favorite_folders(&[root], &mut build_matcher("target"));

        assert_eq!(filtered.len(), 1);
        assert_eq!(child_names(&filtered[0].children), vec!["logs"]);
        assert_eq!(
            child_names(folder_children(&filtered[0].children, "logs")),
            vec!["target.log"]
        );
    }

    #[test]
    fn search_omits_roots_without_matching_files() {
        let root = favorite_folder(
            "/root",
            vec![folder_node(
                "/root/target-folder",
                "target-folder",
                vec![file_node("/root/target-folder/other.log", "other.log")],
            )],
        );

        let filtered = filter_favorite_folders(&[root], &mut build_matcher("target"));

        assert!(filtered.is_empty());
    }

    #[test]
    fn search_cache_rebuilds_when_revision_changes() {
        let mut ui = file_explorer_ui("target");
        let mut storage = storage_with(
            vec![favorite_folder(
                "/root",
                vec![file_node("/root/old.log", "old.log")],
            )],
            1,
        );

        ui.refresh_search_cache(&storage);
        assert!(ui.search_cache.roots.as_ref().is_some_and(Vec::is_empty));

        storage.state = LoadState::Ready(FileExplorerData {
            favorite_folders: vec![favorite_folder(
                "/root",
                vec![file_node("/root/target.log", "target.log")],
            )],
        });
        storage.revision = 2;

        ui.refresh_search_cache(&storage);

        let roots = ui
            .search_cache
            .roots
            .as_ref()
            .expect("search cache should be populated");
        assert_eq!(ui.search_cache.revision, 2);
        assert_eq!(child_names(&roots[0].children), vec!["target.log"]);
    }
}

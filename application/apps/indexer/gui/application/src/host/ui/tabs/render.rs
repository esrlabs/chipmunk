//! Rendering for host tabs and active tab content.

use egui::{Align, Label, RichText, TextStyle, Ui};

use crate::{
    common::{
        phosphor::{self, icons},
        ui::tab_strip::{TabEvent, TabSpec, TabStrip, TabWidth},
    },
    host::ui::{HostState, UiActions, storage::HostStorage},
};

use super::{HostTab, HostTabs};

pub(super) const HOST_TAB_TOP_GAP: f32 = 3.0;
/// Height of the host tab-strip controls.
pub const HOST_TAB_CONTROL_HEIGHT: f32 = 28.0;

const HOST_TAB_ITEM_WIDTH: f32 = 180.0;
const HOST_TAB_HOME_WIDTH: f32 = 36.0;
const HOST_TAB_HOME_ICON_SIZE: f32 = 18.0;
const HOST_TAB_TEXT_STYLE: TextStyle = TextStyle::Body;

/// Returns the total tab-bar height including top spacing.
pub fn host_tab_bar_height() -> f32 {
    HOST_TAB_TOP_GAP + HOST_TAB_CONTROL_HEIGHT
}

fn host_tab_width(ui: &Ui, label: &str, max: Option<f32>) -> TabWidth {
    TabWidth::Dynamic {
        content_width: TabStrip::measure_text_width(ui, label, HOST_TAB_TEXT_STYLE),
        max,
    }
}

impl HostTabs {
    /// Renders the host tab strip and applies tab strip events.
    pub fn render_tab_bar(&mut self, state: &mut HostState, actions: &mut UiActions, ui: &mut Ui) {
        let control_rect = ui.max_rect();
        let strip_id = ui.id().with("host_tab_strip");
        let strip = TabStrip::new(strip_id, self.active_idx)
            .control_height(HOST_TAB_CONTROL_HEIGHT)
            .top_gap(HOST_TAB_TOP_GAP)
            .scroll_step(120.0)
            .rail_side_padding(4.0)
            .has_close_buttons(true);

        self.tab_specs.clear();
        self.tab_specs.extend(self.tabs.iter().map(|tab| {
            match tab {
                HostTab::Home(_) => TabSpec::new(
                    strip_id.with(("host_tab", "home")),
                    TabWidth::Exact(HOST_TAB_HOME_WIDTH),
                )
                .tooltip("Home"),
                HostTab::Session(session) => {
                    let title = session.get_info().title.as_str();
                    TabSpec::new(
                        strip_id.with(("host_tab", session.get_info().id)),
                        host_tab_width(ui, title, Some(HOST_TAB_ITEM_WIDTH)),
                    )
                    .closeable(true)
                    .tooltip(title.to_owned())
                }
                HostTab::SessionSetup(setup) => {
                    let title = setup.title();
                    TabSpec::new(
                        strip_id.with(("host_tab", setup.id())),
                        host_tab_width(ui, title.as_ref(), Some(HOST_TAB_ITEM_WIDTH)),
                    )
                    .closeable(true)
                    .tooltip(title.to_string())
                }
                HostTab::MultiFileSetup(setup) => TabSpec::new(
                    strip_id.with(("host_tab", setup.id())),
                    host_tab_width(ui, "Multiple Files", Some(HOST_TAB_ITEM_WIDTH)),
                )
                .closeable(true)
                .tooltip("Multiple Files"),
                HostTab::PluginManager(_) => TabSpec::new(
                    strip_id.with(("host_tab", "plugins")),
                    host_tab_width(ui, "Plugin Manager", Some(HOST_TAB_ITEM_WIDTH)),
                )
                .closeable(true)
                .tooltip("Plugin Manager"),
                HostTab::AppSettings(_) => TabSpec::new(
                    strip_id.with(("host_tab", "settings")),
                    host_tab_width(ui, "App Settings", Some(HOST_TAB_ITEM_WIDTH)),
                )
                .closeable(true)
                .tooltip("App Settings"),
            }
        }));

        let tabs_event = strip.show(ui, control_rect, &self.tab_specs, |ui, idx| {
            let Some(tab) = self.tabs.get(idx) else {
                return;
            };

            match tab {
                HostTab::Home(_) => {
                    ui.label(
                        RichText::new(icons::fill::HOUSE)
                            .family(phosphor::fill_font_family())
                            .size(HOST_TAB_HOME_ICON_SIZE),
                    );
                }
                HostTab::Session(session) => {
                    let title = session.get_info().title.as_str();
                    tab_label(ui, title);
                }
                HostTab::SessionSetup(setup) => {
                    let title = setup.title();
                    tab_label(ui, title.as_ref());
                }
                HostTab::MultiFileSetup(_) => tab_label(ui, "Multiple Files"),
                HostTab::PluginManager(_) => tab_label(ui, "Plugin Manager"),
                HostTab::AppSettings(_) => tab_label(ui, "App Settings"),
            }
        });

        if let Some(event) = tabs_event {
            match event {
                TabEvent::Select(idx) => self.activate_tab(idx),
                TabEvent::Close(idx) => {
                    self.close_tab_at(idx, &mut state.registry, &mut state.modals, actions);
                }
            }
        }
    }

    /// Renders the active tab content.
    pub fn render_active_content(
        &mut self,
        state: &mut HostState,
        storage: &mut HostStorage,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        let HostState {
            preferences,
            registry,
            plugins,
            modals,
            ..
        } = state;

        match self.active_mut() {
            HostTab::Home(home) => home.render_content(storage, actions, preferences, plugins, ui),
            HostTab::Session(session) => session.render_content(actions, registry, preferences, ui),
            HostTab::SessionSetup(setup) => {
                setup.render_content(actions, &mut storage.recent_sessions, plugins, ui)
            }
            HostTab::MultiFileSetup(setup) => setup.render_content(actions, preferences, ui),
            HostTab::PluginManager(plugin_manager) => {
                plugin_manager.render_content(ui, plugins, actions, preferences, modals)
            }
            HostTab::AppSettings(settings) => settings.render_content(storage, ui),
        }
    }
}

fn tab_label(ui: &mut Ui, title: &str) {
    ui.add(
        Label::new(RichText::new(title).text_style(HOST_TAB_TEXT_STYLE))
            .truncate()
            .show_tooltip_when_elided(false)
            .halign(Align::Center),
    );
}

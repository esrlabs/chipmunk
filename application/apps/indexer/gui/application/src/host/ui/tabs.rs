use egui::{Align, Label, RichText, TextStyle, Ui};
use uuid::Uuid;

use crate::{
    common::{
        phosphor::{self, icons},
        ui::tab_strip::{TabEvent, TabSpec, TabStrip, TabWidth},
    },
    host::ui::HostAction,
};

use super::{HostState, UiActions};

#[derive(Debug, Default)]
pub struct TabsUi {
    tab_specs: Vec<TabSpec<'static>>,
}

pub(super) const HOST_TAB_CONTROL_HEIGHT: f32 = 28.0;
pub(super) const HOST_TAB_TOP_GAP: f32 = 3.0;

const HOST_TAB_ITEM_WIDTH: f32 = 180.0;
const HOST_TAB_HOME_WIDTH: f32 = 36.0;
const HOST_TAB_HOME_ICON_SIZE: f32 = 18.0;
const HOST_TAB_TEXT_STYLE: TextStyle = TextStyle::Body;

pub(super) fn host_tab_bar_height() -> f32 {
    HOST_TAB_TOP_GAP + HOST_TAB_CONTROL_HEIGHT
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum TabType {
    Home,
    Session(Uuid),
    SessionSetup(Uuid),
    MultiFileSetup(Uuid),
}

fn host_tab_width(ui: &Ui, label: &str, max: Option<f32>) -> TabWidth {
    TabWidth::Dynamic {
        content_width: TabStrip::measure_text_width(ui, label, HOST_TAB_TEXT_STYLE),
        max,
    }
}

impl TabsUi {
    pub fn render_all_tabs(&mut self, state: &mut HostState, actions: &mut UiActions, ui: &mut Ui) {
        let control_rect = ui.max_rect();
        let strip_id = ui.id().with("host_tab_strip");
        let strip = TabStrip::new(strip_id, state.active_tab_idx)
            .control_height(HOST_TAB_CONTROL_HEIGHT)
            .top_gap(HOST_TAB_TOP_GAP)
            .scroll_step(120.0)
            .rail_side_padding(4.0)
            .has_close_buttons(true);

        self.tab_specs.clear();
        self.tab_specs.extend(state.tabs.iter().map(|tab| {
            match tab {
                TabType::Home => TabSpec::new(
                    strip_id.with(("host_tab", tab)),
                    TabWidth::Exact(HOST_TAB_HOME_WIDTH),
                )
                .tooltip("Home"),
                TabType::Session(id) => {
                    let title = state
                        .sessions
                        .get(id)
                        .expect("Session from host tab must exist")
                        .get_info()
                        .title
                        .as_str();
                    TabSpec::new(
                        strip_id.with(("host_tab", tab)),
                        host_tab_width(ui, title, Some(HOST_TAB_ITEM_WIDTH)),
                    )
                    .closeable(true)
                    .tooltip(title.to_owned())
                }
                TabType::SessionSetup(id) => {
                    let title = state
                        .session_setups
                        .get(id)
                        .expect("Session setup from host tab must exist")
                        .title();
                    TabSpec::new(
                        strip_id.with(("host_tab", tab)),
                        host_tab_width(ui, title.as_ref(), Some(HOST_TAB_ITEM_WIDTH)),
                    )
                    .closeable(true)
                    .tooltip(title.to_string())
                }
                TabType::MultiFileSetup(_) => TabSpec::new(
                    strip_id.with(("host_tab", tab)),
                    host_tab_width(ui, "Multiple Files", Some(HOST_TAB_ITEM_WIDTH)),
                )
                .closeable(true)
                .tooltip("Multiple Files"),
            }
        }));

        let tabs_event = strip.show(ui, control_rect, &self.tab_specs, |ui, idx| {
            let Some(tab) = state.tabs.get(idx) else {
                return;
            };
            match tab {
                TabType::Home => {
                    ui.label(
                        RichText::new(icons::fill::HOUSE)
                            .family(phosphor::fill_font_family())
                            .size(HOST_TAB_HOME_ICON_SIZE),
                    );
                }
                TabType::Session(id) => {
                    let title = state
                        .sessions
                        .get(id)
                        .expect("Session from host tab must exist")
                        .get_info()
                        .title
                        .as_str();
                    ui.add(
                        Label::new(RichText::new(title).text_style(HOST_TAB_TEXT_STYLE))
                            .truncate()
                            .show_tooltip_when_elided(false)
                            .halign(Align::Center),
                    );
                }
                TabType::SessionSetup(id) => {
                    let title = state
                        .session_setups
                        .get(id)
                        .expect("Session setup from host tab must exist")
                        .title();
                    ui.add(
                        Label::new(RichText::new(title.as_ref()).text_style(HOST_TAB_TEXT_STYLE))
                            .truncate()
                            .show_tooltip_when_elided(false)
                            .halign(Align::Center),
                    );
                }
                TabType::MultiFileSetup(_) => {
                    ui.add(
                        Label::new(RichText::new("Multiple Files").text_style(HOST_TAB_TEXT_STYLE))
                            .truncate()
                            .show_tooltip_when_elided(false)
                            .halign(Align::Center),
                    );
                }
            }
        });

        if let Some(event) = tabs_event {
            self.apply_tab_event(state, actions, event);
        }
    }

    fn apply_tab_event(&mut self, state: &mut HostState, actions: &mut UiActions, event: TabEvent) {
        match event {
            TabEvent::Select(idx) => state.active_tab_idx = idx,
            TabEvent::Close(idx) => {
                let Some(tab) = state.tabs.get(idx).cloned() else {
                    return;
                };

                match tab {
                    TabType::Home => {
                        debug_assert!(false, "Home tab is not closeable");
                    }
                    TabType::Session(id) => actions.add_host_action(HostAction::CloseSession(id)),
                    TabType::SessionSetup(id) => {
                        state
                            .session_setups
                            .get(&id)
                            .expect("Session setup from host tab must exist")
                            .close(actions);
                    }
                    TabType::MultiFileSetup(id) => {
                        state
                            .multi_setups
                            .get(&id)
                            .expect("Multiple files setup from host tab must exist")
                            .close(actions);
                    }
                }
            }
        }
    }
}

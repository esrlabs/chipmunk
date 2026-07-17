//! Drag-and-drop behavior for Filters sidebar rows and groups.

use std::sync::Arc;

use egui::{Response, Stroke, Ui, vec2};

use crate::host::{common::ui_utls::side_panel_group_frame, ui::registry::filters::FilterRegistry};

use super::SelectedSidebarItem;
use super::actions::FilterPanelAction;

/// Drag payload for a filter or chart row.
#[derive(Debug, Clone)]
pub(super) struct SidebarDrag {
    item: SelectedSidebarItem,
    source_index: usize,
    insert_index: usize,
}

impl SidebarDrag {
    /// Creates a payload whose initial insertion slot is its source position.
    pub(super) fn new(item: SelectedSidebarItem, source_index: usize) -> Self {
        Self {
            item,
            source_index,
            insert_index: source_index,
        }
    }
}

/// Sidebar list that can receive a dragged row.
#[derive(Debug, Clone, Copy)]
pub(super) enum SidebarDropTarget {
    Filter,
    SearchValue,
}

/// Registers a row payload and handles a drop released over that row.
pub(super) fn handle_row(
    ui: &Ui,
    response: &Response,
    drag: Option<SidebarDrag>,
    registry: &FilterRegistry,
) -> Option<FilterPanelAction> {
    let drag = drag?;
    let item = drag.item;
    let row_index = drag.insert_index;
    response.dnd_set_drag_payload(drag);
    let target = match item {
        SelectedSidebarItem::Filter(_) => SidebarDropTarget::Filter,
        SelectedSidebarItem::SearchValue(_) => SidebarDropTarget::SearchValue,
    };
    handle_item_drop(ui, response, item, row_index, target, registry)
}

/// Renders a sidebar group and handles drops that append to it.
pub(super) fn render_group(
    ui: &mut Ui,
    registry: &FilterRegistry,
    target: SidebarDropTarget,
    append_index: usize,
    dnd_enabled: bool,
    add_contents: impl FnOnce(&mut Ui),
) -> Option<FilterPanelAction> {
    // Build the frame manually so payload eligibility can determine its border before paint.
    let mut frame = side_panel_group_frame(ui).begin(ui);
    frame.content_ui.take_available_width();
    add_contents(&mut frame.content_ui);
    let response = frame.allocate_space(ui);

    let hovered_source = if dnd_enabled {
        response.dnd_hover_payload::<SidebarDrag>()
    } else {
        None
    };
    let can_drop = hovered_source
        .as_ref()
        .is_some_and(|source| can_drop(source.item, target, registry));
    if can_drop {
        frame.frame.stroke = ui.visuals().selection.stroke;
    }
    frame.paint(ui);

    if !can_drop {
        return None;
    }

    // Rows claim precise releases first; remaining group drops append, including empty groups.
    // Keep Arc::make_mut allocation-free during the normal release flow.
    drop(hovered_source);
    let mut source = response.dnd_release_payload::<SidebarDrag>()?;
    let source = Arc::make_mut(&mut source);
    source.insert_index = append_index;
    let action = drop_action(source, target);
    Some(action)
}

fn handle_item_drop(
    ui: &Ui,
    response: &Response,
    item: SelectedSidebarItem,
    row_index: usize,
    target: SidebarDropTarget,
    registry: &FilterRegistry,
) -> Option<FilterPanelAction> {
    let source = response.dnd_hover_payload::<SidebarDrag>()?;
    if !can_drop(source.item, target, registry) {
        return None;
    }

    let pointer = ui.input(|input| input.pointer.interact_pos())?;
    let drop_stroke = ui.visuals().selection.stroke;

    const TOP_LINE_OFFSET: f32 = 2.0;
    const BOTTOM_LINE_OFFSET: f32 = 6.0;

    // Each row exposes the insertion slots above and below it. The source row uses
    // its trailing equivalent slot so dropping directly on it remains a no-op.
    let (insert_index, line_y) = if source.item == item {
        let line_y = response.rect.bottom() - drop_stroke.width / 2.0 + BOTTOM_LINE_OFFSET;
        (row_index, line_y)
    } else if pointer.y < response.rect.center().y {
        let line_y = response.rect.top() + drop_stroke.width / 2.0 - TOP_LINE_OFFSET;
        (row_index, line_y)
    } else {
        let line_y = response.rect.bottom() - drop_stroke.width / 2.0 + BOTTOM_LINE_OFFSET;
        (row_index + 1, line_y)
    };

    let same_list = match (source.item, target) {
        (SelectedSidebarItem::Filter(_), SidebarDropTarget::Filter)
        | (SelectedSidebarItem::SearchValue(_), SidebarDropTarget::SearchValue) => true,
        (SelectedSidebarItem::Filter(_), SidebarDropTarget::SearchValue)
        | (SelectedSidebarItem::SearchValue(_), SidebarDropTarget::Filter) => false,
    };
    // Match the post-removal insertion adjustment used by FiltersState.
    let destination_index = if same_list && source.source_index < insert_index {
        insert_index - 1
    } else {
        insert_index
    };
    let stroke = if same_list && source.source_index == destination_index {
        Stroke::new(drop_stroke.width, drop_stroke.color.gamma_multiply(0.5))
    } else {
        drop_stroke
    };

    // The offsets place lines in row spacing, so allow painting beyond the response bounds.
    let line_clip_rect = response
        .interact_rect
        .expand2(vec2(0.0, BOTTOM_LINE_OFFSET))
        .intersect(ui.clip_rect());
    response
        .ctx
        .layer_painter(response.layer_id)
        .with_clip_rect(line_clip_rect)
        .hline(response.rect.x_range(), line_y, stroke);

    // Keep Arc::make_mut allocation-free during the normal release flow.
    drop(source);
    let mut source = response.dnd_release_payload::<SidebarDrag>()?;
    let source = Arc::make_mut(&mut source);
    source.insert_index = insert_index;
    let action = drop_action(source, target);
    Some(action)
}

fn can_drop(
    source: SelectedSidebarItem,
    target: SidebarDropTarget,
    registry: &FilterRegistry,
) -> bool {
    match (source, target) {
        (SelectedSidebarItem::Filter(filter_id), SidebarDropTarget::SearchValue) => registry
            .get_filter(&filter_id)
            .is_some_and(|def| def.search_value_eligibility.is_eligible()),
        (SelectedSidebarItem::Filter(filter_id), SidebarDropTarget::Filter) => {
            registry.get_filter(&filter_id).is_some()
        }
        (SelectedSidebarItem::SearchValue(value_id), _) => {
            registry.get_search_value(&value_id).is_some()
        }
    }
}

fn drop_action(source: &SidebarDrag, target: SidebarDropTarget) -> FilterPanelAction {
    match (source.item, target) {
        (item @ SelectedSidebarItem::Filter(_), SidebarDropTarget::Filter)
        | (item @ SelectedSidebarItem::SearchValue(_), SidebarDropTarget::SearchValue) => {
            FilterPanelAction::ReorderItem(item, source.insert_index)
        }
        (SelectedSidebarItem::Filter(filter_id), SidebarDropTarget::SearchValue) => {
            FilterPanelAction::MoveFilterToValue(filter_id, Some(source.insert_index))
        }
        (SelectedSidebarItem::SearchValue(value_id), SidebarDropTarget::Filter) => {
            FilterPanelAction::MoveValueToFilter(value_id, Some(source.insert_index))
        }
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;

    use crate::host::ui::registry::filters::{FilterDefinition, FilterRegistry};

    use super::super::SelectedSidebarItem;
    use super::{SidebarDropTarget, can_drop};

    #[test]
    fn chart_drop_accepts_only_eligible_filters() {
        let mut registry = FilterRegistry::default();
        let ineligible_id = registry.add_filter(FilterDefinition::new(SearchFilter::plain("cpu")));
        let eligible_id = registry.add_filter(FilterDefinition::new(
            SearchFilter::plain("cpu=(\\d+)").regex(true),
        ));
        let target = SidebarDropTarget::SearchValue;

        assert!(!can_drop(
            SelectedSidebarItem::Filter(ineligible_id),
            target,
            &registry,
        ));
        assert!(can_drop(
            SelectedSidebarItem::Filter(eligible_id),
            target,
            &registry,
        ));
    }
}

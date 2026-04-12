use rustc_hash::FxHashSet;

#[derive(Debug, Default)]
pub struct LogsState {
    pub logs_count: u64,
    /// The stream position of the log which the main logs table
    /// should scroll into.
    pub scroll_main_row: Option<u64>,
    /// Selected rows keyed by original stream position.
    selected_rows: FxHashSet<u64>,
    /// Most recent row explicitly selected by the user.
    last_selected_row: Option<u64>,
    /// Bookmarked rows keyed by original stream position.
    pub bookmarked_rows: FxHashSet<u64>,
}

/// Describes which UI actions should happen after a selection change is applied.
///
/// `LogsState` updates the selected rows first, then returns this value so callers
/// can trigger side effects such as loading details or syncing the other table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectionChange {
    /// Single row to load in the details panel.
    pub details_row: Option<u64>,
    /// Single row to align in the peer table after an exclusive selection.
    pub jump_to_row: Option<u64>,
}

/// Describes how a row should affect the current selection.
///
/// The UI layer maps raw input state such as keyboard modifiers into one of these
/// intents before applying selection semantics in `LogsState`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectionIntent {
    /// Applies exclusive selection semantics for this row.
    ///
    /// This may select only this row, collapse a multi-selection to this row,
    /// or clear the selection if this row is already selected exclusively.
    /// This is the only intent that may request peer-table alignment.
    Exclusive,
    /// Toggles whether this row belongs to the current selection.
    ///
    /// If the row is not selected, it is added.
    /// If the row is already selected, it is removed.
    /// Other selected rows stay selected.
    /// This intent never requests peer-table alignment.
    ToggleRow,
    /// Adds the inclusive range from the current anchor to this row.
    ///
    /// Existing selected rows stay selected.
    /// This intent never requests peer-table alignment.
    ExtendRange,
}

impl LogsState {
    /// Returns whether `row` is part of the current selection.
    pub fn is_selected(&self, row: u64) -> bool {
        self.selected_rows.contains(&row)
    }

    /// Returns the number of selected rows.
    pub fn selected_count(&self) -> usize {
        self.selected_rows.len()
    }

    /// Returns the selected row only when the selection is singular.
    pub fn single_selected_row(&self) -> Option<u64> {
        if self.selected_rows.len() == 1 {
            self.selected_rows.iter().next().copied()
        } else {
            None
        }
    }

    /// Replaces the current selection with exactly `row`.
    pub fn replace_selection_with(&mut self, row: u64) -> SelectionChange {
        self.selected_rows.clear();
        self.selected_rows.insert(row);
        self.last_selected_row = Some(row);
        self.selection_change(SelectionIntent::Exclusive)
    }

    /// Applies a click mode and returns the resulting selection side effects.
    pub fn select_from_click(
        &mut self,
        row: u64,
        selection_intent: SelectionIntent,
    ) -> SelectionChange {
        let was_selected = self.is_selected(row);

        match selection_intent {
            SelectionIntent::ExtendRange if was_selected => {
                return SelectionChange {
                    details_row: None,
                    jump_to_row: None,
                };
            }
            SelectionIntent::ExtendRange => {
                if let Some(anchor_row) = self.last_selected_row {
                    for pos in anchor_row.min(row)..=anchor_row.max(row) {
                        self.selected_rows.insert(pos);
                    }
                } else {
                    self.selected_rows.clear();
                    self.selected_rows.insert(row);
                }
            }
            SelectionIntent::Exclusive => {
                if was_selected && self.selected_rows.len() == 1 {
                    self.selected_rows.clear();
                } else {
                    self.selected_rows.clear();
                    self.selected_rows.insert(row);
                }
            }
            SelectionIntent::ToggleRow => {
                if !self.selected_rows.remove(&row) {
                    self.selected_rows.insert(row);
                }
            }
        }

        self.last_selected_row = if self.selected_rows.is_empty() {
            None
        } else {
            Some(row)
        };
        self.selection_change(selection_intent)
    }

    /// Derives follow-up actions from the current selection state and intent.
    fn selection_change(&self, selection_intent: SelectionIntent) -> SelectionChange {
        let selected_row = self.single_selected_row();
        SelectionChange {
            details_row: selected_row,
            jump_to_row: matches!(selection_intent, SelectionIntent::Exclusive)
                .then_some(selected_row)
                .flatten(),
        }
    }

    /// Returns whether `row` is bookmarked.
    #[inline]
    pub fn is_bookmarked(&self, row: u64) -> bool {
        self.bookmarked_rows.contains(&row)
    }

    /// Marks `row` as bookmarked.
    #[inline]
    pub fn insert_bookmark(&mut self, row: u64) -> bool {
        self.bookmarked_rows.insert(row)
    }

    /// Removes the bookmark for `row`.
    #[inline]
    pub fn remove_bookmark(&mut self, row: u64) -> bool {
        self.bookmarked_rows.remove(&row)
    }
}

#[cfg(test)]
mod tests {
    use super::{LogsState, SelectionIntent};

    const EXCLUSIVE: SelectionIntent = SelectionIntent::Exclusive;
    const TOGGLE_ROW: SelectionIntent = SelectionIntent::ToggleRow;
    const EXTEND_RANGE: SelectionIntent = SelectionIntent::ExtendRange;

    #[test]
    fn plain_click_replaces_selection() {
        let mut state = LogsState::default();

        state.replace_selection_with(3);
        let change = state.select_from_click(8, EXCLUSIVE);

        assert_eq!(state.single_selected_row(), Some(8));
        assert_eq!(change.details_row, Some(8));
        assert_eq!(change.jump_to_row, Some(8));
        assert_eq!(state.selected_rows, [8].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(8));
    }

    #[test]
    fn plain_click_on_selected_row_keeps_only_that_row() {
        let mut state = LogsState::default();

        state.replace_selection_with(3);
        state.select_from_click(8, TOGGLE_ROW);
        let change = state.select_from_click(8, EXCLUSIVE);

        assert_eq!(state.single_selected_row(), Some(8));
        assert_eq!(change.details_row, Some(8));
        assert_eq!(change.jump_to_row, Some(8));
        assert_eq!(state.selected_rows, [8].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(8));
    }

    #[test]
    fn plain_click_on_single_selected_row_clears_selection() {
        let mut state = LogsState::default();

        state.replace_selection_with(8);
        let change = state.select_from_click(8, EXCLUSIVE);

        assert_eq!(state.single_selected_row(), None);
        assert_eq!(change.details_row, None);
        assert_eq!(change.jump_to_row, None);
        assert!(state.selected_rows.is_empty());
        assert_eq!(state.last_selected_row, None);
    }

    #[test]
    fn command_click_toggles_row() {
        let mut state = LogsState::default();

        state.replace_selection_with(3);
        let change = state.select_from_click(3, TOGGLE_ROW);

        assert_eq!(state.single_selected_row(), None);
        assert_eq!(change.details_row, None);
        assert_eq!(change.jump_to_row, None);
        assert!(state.selected_rows.is_empty());
        assert_eq!(state.last_selected_row, None);
    }

    #[test]
    fn toggle_row_keeps_remaining_single_selection_without_jump() {
        let mut state = LogsState::default();

        state.replace_selection_with(3);
        state.select_from_click(8, TOGGLE_ROW);
        let change = state.select_from_click(8, TOGGLE_ROW);

        assert_eq!(state.single_selected_row(), Some(3));
        assert_eq!(change.details_row, Some(3));
        assert_eq!(change.jump_to_row, None);
        assert_eq!(state.selected_rows, [3].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(8));
    }

    #[test]
    fn toggle_row_from_empty_selects_without_jump() {
        let mut state = LogsState::default();

        let change = state.select_from_click(8, TOGGLE_ROW);

        assert_eq!(state.single_selected_row(), Some(8));
        assert_eq!(change.details_row, Some(8));
        assert_eq!(change.jump_to_row, None);
        assert_eq!(state.selected_rows, [8].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(8));
    }

    #[test]
    fn shift_after_clearing_selection_uses_current_row_only() {
        let mut state = LogsState::default();

        state.replace_selection_with(10);
        state.select_from_click(10, TOGGLE_ROW);
        let change = state.select_from_click(20, EXTEND_RANGE);

        assert_eq!(state.single_selected_row(), Some(20));
        assert_eq!(change.details_row, Some(20));
        assert_eq!(change.jump_to_row, None);
        assert_eq!(state.selected_rows, [20].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(20));
    }

    #[test]
    fn shift_without_anchor_selects_current_row() {
        let mut state = LogsState::default();
        state.selected_rows.extend([2, 4]);

        let change = state.select_from_click(6, EXTEND_RANGE);

        assert_eq!(state.single_selected_row(), Some(6));
        assert_eq!(change.details_row, Some(6));
        assert_eq!(change.jump_to_row, None);
        assert_eq!(state.selected_rows, [6].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(6));
    }

    #[test]
    fn shift_click_on_selected_row_is_ignored() {
        let mut state = LogsState::default();

        state.replace_selection_with(4);
        state.select_from_click(7, EXTEND_RANGE);
        let change = state.select_from_click(7, EXTEND_RANGE);

        assert_eq!(state.single_selected_row(), None);
        assert_eq!(change.details_row, None);
        assert_eq!(change.jump_to_row, None);
        assert_eq!(state.selected_rows, [4, 5, 6, 7].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(7));
    }

    #[test]
    fn shift_click_preserves_existing_selection() {
        let mut state = LogsState::default();

        state.replace_selection_with(2);
        state.select_from_click(9, TOGGLE_ROW);
        let change = state.select_from_click(7, EXTEND_RANGE);

        assert_eq!(state.single_selected_row(), None);
        assert_eq!(change.details_row, None);
        assert_eq!(change.jump_to_row, None);
        assert_eq!(state.selected_rows, [2, 7, 8, 9].into_iter().collect());
        assert_eq!(state.last_selected_row, Some(7));
    }

    #[test]
    fn repeated_shift_click_extends_from_latest_anchor() {
        let mut state = LogsState::default();

        state.replace_selection_with(4);
        state.select_from_click(7, EXTEND_RANGE);
        let change = state.select_from_click(10, EXTEND_RANGE);

        assert_eq!(state.single_selected_row(), None);
        assert_eq!(change.details_row, None);
        assert_eq!(change.jump_to_row, None);
        assert_eq!(
            state.selected_rows,
            [4, 5, 6, 7, 8, 9, 10].into_iter().collect()
        );
        assert_eq!(state.last_selected_row, Some(10));
    }

    #[test]
    fn command_shift_click_adds_range() {
        let mut state = LogsState::default();

        state.replace_selection_with(2);
        state.select_from_click(9, TOGGLE_ROW);
        let change = state.select_from_click(5, EXTEND_RANGE);

        assert_eq!(state.single_selected_row(), None);
        assert_eq!(change.details_row, None);
        assert_eq!(change.jump_to_row, None);
        assert_eq!(
            state.selected_rows,
            [2, 5, 6, 7, 8, 9].into_iter().collect()
        );
        assert_eq!(state.last_selected_row, Some(5));
    }

    #[test]
    fn single_selected_row_requires_exactly_one_row() {
        let mut state = LogsState::default();

        assert_eq!(state.single_selected_row(), None);

        state.replace_selection_with(11);
        assert_eq!(state.single_selected_row(), Some(11));

        state.select_from_click(14, TOGGLE_ROW);
        assert_eq!(state.single_selected_row(), None);
    }
}

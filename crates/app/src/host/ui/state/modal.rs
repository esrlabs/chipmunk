//! Exclusive top-level dialogs and caller-polled confirmation answers.

/// Stores the active top-level dialog and resolved confirmation answers awaiting collection.
#[derive(Debug, Default)]
pub struct HostModalState {
    active: Option<HostModal>,
    confirmation_results: Vec<ConfirmationResult>,
}

/// Top-level dialogs that block interaction with the rest of the host UI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostModal {
    /// Application metadata and links.
    About,
    /// Keyboard shortcuts overview.
    Shortcuts,
    /// Release notes for the first launch after an application update.
    Changelog,
    /// Caller-owned confirmation dialog with a pollable answer.
    Confirmation(ConfirmationDialog),
}

/// Confirmation dialog text and caller-owned result identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfirmationDialog {
    /// Caller-owned identifier used to retrieve the answer.
    pub id: String,
    /// Heading shown at the top of the dialog.
    pub title: String,
    /// Body text explaining what is being confirmed.
    pub message: String,
    /// Button label for accepting the action.
    pub confirm_label: String,
    /// Button label for cancelling the action.
    pub cancel_label: String,
}

/// Answer produced by a confirmation dialog.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmationAnswer {
    /// The user accepted the action.
    Confirmed,
    /// The user cancelled or dismissed the dialog.
    Cancelled,
}

/// Confirmation answer waiting to be collected by its owning flow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfirmationResult {
    /// Caller-owned dialog identifier.
    pub id: String,
    /// User answer for the matching dialog.
    pub answer: ConfirmationAnswer,
}

impl ConfirmationDialog {
    /// Creates a confirmation dialog with default action labels.
    pub fn new(
        id: impl Into<String>,
        title: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            message: message.into(),
            confirm_label: "Confirm".to_owned(),
            cancel_label: "Cancel".to_owned(),
        }
    }

    /// Overrides the label for accepting the action.
    pub fn with_confirm_label(mut self, label: impl Into<String>) -> Self {
        self.confirm_label = label.into();
        self
    }

    /// Overrides the label for cancelling the action.
    pub fn with_cancel_label(mut self, label: impl Into<String>) -> Self {
        self.cancel_label = label.into();
        self
    }
}

impl HostModalState {
    /// Returns the currently active modal, if any.
    pub fn active(&self) -> Option<&HostModal> {
        self.active.as_ref()
    }

    /// Opens a dialog if no other top-level dialog is active.
    pub fn open(&mut self, modal: HostModal) -> bool {
        if self.active.is_some() {
            return false;
        }

        self.active = Some(modal);
        true
    }

    /// Clears the active dialog without recording a confirmation answer.
    pub fn close(&mut self) {
        self.active = None;
    }

    /// Records an answer for the active confirmation dialog.
    pub fn resolve_confirmation(&mut self, answer: ConfirmationAnswer) {
        let Some(active) = self.active.take() else {
            return;
        };

        match active {
            HostModal::Confirmation(dialog) => {
                self.confirmation_results.push(ConfirmationResult {
                    id: dialog.id,
                    answer,
                });
            }
            modal => {
                self.active = Some(modal);
            }
        }
    }

    /// Returns whether any confirmation answer is waiting to be collected.
    pub fn has_confirmation_results(&self) -> bool {
        !self.confirmation_results.is_empty()
    }

    /// Removes and returns the first stored confirmation answer for the dialog id.
    pub fn take_confirmation_result(&mut self, id: &str) -> Option<ConfirmationAnswer> {
        let result_idx = self
            .confirmation_results
            .iter()
            .position(|result| result.id == id)?;

        Some(self.confirmation_results.remove(result_idx).answer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONFIRMATION_ID: &str = "test_confirmation";

    #[test]
    fn opens_modal_when_none_active() {
        let mut state = HostModalState::default();

        assert!(state.open(HostModal::About));
        assert!(matches!(state.active(), Some(HostModal::About)));
    }

    #[test]
    fn rejects_modal_when_one_is_active() {
        let mut state = HostModalState::default();

        assert!(state.open(HostModal::About));

        assert!(!state.open(HostModal::Shortcuts));
        assert!(matches!(state.active(), Some(HostModal::About)));
    }

    #[test]
    fn close_clears_active_modal() {
        let mut state = HostModalState::default();
        state.open(HostModal::About);

        state.close();

        assert!(state.active().is_none());
    }

    #[test]
    fn stores_confirmed_result() {
        let mut state = HostModalState::default();
        state.open(confirmation_modal());

        state.resolve_confirmation(ConfirmationAnswer::Confirmed);

        assert_eq!(
            state.take_confirmation_result(CONFIRMATION_ID),
            Some(ConfirmationAnswer::Confirmed)
        );
    }

    #[test]
    fn stores_cancelled_result() {
        let mut state = HostModalState::default();
        state.open(confirmation_modal());

        state.resolve_confirmation(ConfirmationAnswer::Cancelled);

        assert_eq!(
            state.take_confirmation_result(CONFIRMATION_ID),
            Some(ConfirmationAnswer::Cancelled)
        );
    }

    #[test]
    fn takes_result_once() {
        let mut state = HostModalState::default();
        state.open(confirmation_modal());
        state.resolve_confirmation(ConfirmationAnswer::Confirmed);

        assert_eq!(
            state.take_confirmation_result(CONFIRMATION_ID),
            Some(ConfirmationAnswer::Confirmed)
        );
        assert_eq!(state.take_confirmation_result(CONFIRMATION_ID), None);
    }

    #[test]
    fn tracks_pending_results() {
        let mut state = HostModalState::default();

        assert!(!state.has_confirmation_results());

        state.open(confirmation_modal());
        state.resolve_confirmation(ConfirmationAnswer::Confirmed);

        assert!(state.has_confirmation_results());

        state.take_confirmation_result(CONFIRMATION_ID);

        assert!(!state.has_confirmation_results());
    }

    #[test]
    fn unknown_result_id_returns_none() {
        let mut state = HostModalState::default();

        assert_eq!(state.take_confirmation_result("missing"), None);
    }

    fn confirmation_modal() -> HostModal {
        HostModal::Confirmation(ConfirmationDialog::new(
            CONFIRMATION_ID,
            "Confirm",
            "Continue?",
        ))
    }
}

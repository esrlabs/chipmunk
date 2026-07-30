//! Runtime shortcut state shared by host and active-tab shortcut handlers.
//!
//! The state stores the latest unconsumed key press for sequence-style shortcuts and semantic
//! shortcut actions pending until the end of the current UI pass. It does not assign meaning to
//! keys; shortcut handlers do that.

use std::vec::Drain;

use egui::{Context, Event, Key, Modifiers};
use session_core::state::IndexedNavigation;
use uuid::Uuid;

const LAST_KEY_TIMEOUT_SECONDS: f64 = 0.75;

/// Stores transient shortcut input across frames.
#[derive(Debug, Default)]
pub struct ShortcutState {
    /// Last unconsumed pressed key while there is no input-text active.
    /// Used to handle vim like keybindings.
    last_key: Option<LastShortcutKey>,
    pending_actions: Vec<ShortcutAction>,
}

/// Semantic shortcut work deferred until the current host UI pass has rendered.
#[derive(Debug)]
pub enum ShortcutAction {
    /// Requests nested navigation for a specific session.
    FindNestedMatch {
        /// Session that owned the consumed shortcut.
        session_id: Uuid,
        /// Direction to navigate through nested matches.
        direction: IndexedNavigation,
    },
}

/// A key press left unconsumed by shortcut handlers in a recent frame.
#[derive(Debug, Clone, Copy)]
pub struct LastShortcutKey {
    key: Key,
    modifiers: Modifiers,
    /// egui input time in seconds when this key was pressed.
    pressed_at: f64,
}

impl ShortcutState {
    /// Clears the last stored key press.
    pub fn clear_last_key(&mut self) {
        self.last_key = None;
    }

    /// Queues semantic work for post-render dispatch in the current UI pass.
    pub fn queue_action(&mut self, action: ShortcutAction) {
        self.pending_actions.push(action);
    }

    /// Drains semantic work queued during the current UI pass.
    pub fn drain_actions(&mut self) -> Drain<'_, ShortcutAction> {
        self.pending_actions.drain(..)
    }

    /// Returns whether semantic work is waiting for post-render dispatch.
    pub fn has_pending_actions(&self) -> bool {
        !self.pending_actions.is_empty()
    }

    /// Takes the last stored key press if it is still within the sequence timeout.
    pub fn take_last_key(&mut self, ctx: &Context) -> Option<LastShortcutKey> {
        let now = ctx.input(|input| input.time);
        self.last_key.take().filter(|key| key.is_fresh(now))
    }

    /// Stores the latest unconsumed key press from this frame when text input is not focused.
    pub fn store_last_key(&mut self, ctx: &Context) {
        if ctx.text_edit_focused() {
            return;
        }

        let (now, last_key) = ctx.input(|input| {
            let last_key = input.events.iter().rev().find_map(|event| {
                let Event::Key {
                    key,
                    modifiers,
                    pressed: true,
                    ..
                } = event
                else {
                    return None;
                };

                Some((*key, *modifiers))
            });
            (input.time, last_key)
        });

        if let Some((key, modifiers)) = last_key {
            let key = LastShortcutKey {
                key,
                modifiers,
                pressed_at: now,
            };
            self.last_key = Some(key);
        }
    }
}

impl LastShortcutKey {
    /// Returns true when this stored key has the exact key and modifiers.
    pub fn matches_key(&self, modifiers: Modifiers, key: Key) -> bool {
        self.modifiers == modifiers && self.key == key
    }

    fn is_fresh(&self, now: f64) -> bool {
        now - self.pressed_at <= LAST_KEY_TIMEOUT_SECONDS
    }
}

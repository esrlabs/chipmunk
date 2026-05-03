//! Exact shortcut matching utilities that consume owned keyboard events from egui input.

use egui::{Context, Event, ImeEvent, Key, KeyboardShortcut};

use super::definitions::Shortcut;

/// Consumes one matching shortcut press using exact modifier matching.
///
/// `egui::InputState::consume_shortcut` intentionally ignores extra Shift/Alt modifiers for
/// layout-friendly text shortcuts. App shortcuts need stricter matching so `Cmd/Ctrl+Shift+F`
/// does not also trigger `Cmd/Ctrl+F`.
pub fn consume_shortcut(ctx: &Context, shortcut: &Shortcut) -> bool {
    shortcut
        .bindings
        .iter()
        .any(|binding| consume_binding(ctx, binding))
}

/// Consumes one press for a single keyboard binding using exact modifier matching.
pub fn consume_binding(ctx: &Context, binding: &KeyboardShortcut) -> bool {
    ctx.input_mut(|input| {
        let mut consumed = false;
        input.events.retain(|event| {
            let matched = shortcut_matches_event(binding, event);
            consumed |= matched;
            !matched
        });

        if consumed {
            // Some Alt shortcuts also emit text input on Linux/layout combinations.
            // Once a shortcut owns the key press, prevent the focused text field from
            // receiving the same input as typed text.
            input.events.retain(|event| !is_text_input_event(event));
        }

        consumed
    })
}

/// Consumes `?` only when no text edit is focused.
pub fn consume_questionmark(ctx: &Context) -> bool {
    if ctx.text_edit_focused() {
        return false;
    }

    ctx.input_mut(|input| {
        let mut consumed = false;
        input.events.retain(|event| {
            let matched = matches!(
                event,
                Event::Key {
                    key: Key::Questionmark,
                    pressed: true,
                    ..
                }
            );
            consumed |= matched;
            !matched
        });

        consumed
    })
}

/// Returns true for events that can insert text into focused text widgets.
fn is_text_input_event(event: &Event) -> bool {
    matches!(event, Event::Text(_) | Event::Ime(ImeEvent::Commit(_)))
}

fn shortcut_matches_event(binding: &KeyboardShortcut, event: &Event) -> bool {
    let Event::Key {
        key,
        physical_key,
        modifiers,
        pressed: true,
        ..
    } = event
    else {
        return false;
    };

    modifiers.matches_exact(binding.modifiers)
        && (*key == binding.logical_key
            || digit_physical_key_matches(binding.logical_key, *physical_key))
}

/// Matches positional digit shortcuts by physical key.
///
/// `Shift+digit` can produce a punctuation logical key. For example, on common Linux layouts,
/// `Ctrl+Shift+1` arrives as logical `Key::Exclamationmark` with physical `Key::Num1`. Other
/// shifted digits may appear to work without this fallback only because egui does not model every
/// shifted symbol and falls back to the physical digit key. That behavior is layout-dependent.
///
/// Keep this fallback limited to digits: shortcuts like `Cmd/Ctrl+F` are named actions and should
/// follow the user's logical keyboard layout (for example: ctrl+f stays ctrl+f on Dvorak Layout),
/// while tab-number shortcuts are positional.
fn digit_physical_key_matches(binding_key: Key, physical_key: Option<Key>) -> bool {
    matches!(
        binding_key,
        Key::Num0
            | Key::Num1
            | Key::Num2
            | Key::Num3
            | Key::Num4
            | Key::Num5
            | Key::Num6
            | Key::Num7
            | Key::Num8
            | Key::Num9
    ) && physical_key == Some(binding_key)
}

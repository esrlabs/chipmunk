# GUI Application UI Rules

## Scope

Applies to `egui` and `eframe` code, which lives in the GUI application crate `crates/app`.
It applies on top of `.ai/rules/rust.md`, which holds for this code as well.

## The Frame Loop Is Hot

`update` and every `ui` path run on each frame. Keep out of them:

- compute-heavy work,
- per-frame allocation,
- eager formatting of text that may never be shown,
- derived values recomputed from scratch on every frame.

Instead:

- Move work off the UI thread when its result does not have to be recomputed every frame.
- Cache reusable derived values such as validation results, filtered views, and formatted summaries, and invalidate them when their inputs change.

## Red Flag: IO and Blocking Calls in the Render Loop

Never perform IO in `update` or in any `ui` path: file reads and writes, directory scans, file metadata queries, network requests, or spawning processes. The same holds for every other blocking call, such as waiting on a channel or a lock, or driving a future with `block_on`.

Each of these stalls the frame and freezes the window for the duration of the call. The cost stays invisible on a fast local machine with a warm cache, and appears on large files, slow or remote storage, and unreachable endpoints.

Run the work in a host or session service instead, wrapping synchronous IO in `spawn_blocking` so the async runtime is not blocked either, and deliver the result to the UI as a `HostMessage` or `SessionMessage`. The UI renders from the state that message updated.

Sending a message must also wake the UI, otherwise the result stays invisible until an unrelated frame happens to be drawn. `evaluate_send_res` in `crates/app/src/common/comm_utls.rs` requests the repaint on a successful send. Use it rather than a hand-rolled channel send, on the service side as well.

The one sanctioned exception is grabbing log lines for the table being drawn, in `TableDelegate::prepare` of the logs and search tables. Those rows have to reach the screen in the frame that asks for them, so the grab blocks, with a retry and a timeout. Nothing else in the render loop may block.

## Commands and Failures

- Send commands from the UI through `UiActions::try_send_command` or `send_command_with_retry`, not through a channel sender directly. The helper logs the failure and raises a notification, while a raw send drops the user action silently.
- Surface failures as an `AppNotification` together with a log entry. Widgets do not render error text inline. `Session::ok_or_notify` is the standard log-then-notify adapter.

## Shared UI Code

Before writing a UI building block, look for an existing one. Shared UI code lives in `crates/app/src/common/ui/`, `crates/app/src/host/common/`, and the `shared/` modules of each area. Reusing it keeps styling and behavior consistent across the app, while a local reimplementation drifts from the rest of it.

Native file dialogs go through `actions.file_dialog` in `crates/app/src/host/ui/actions/file_dialog.rs`.

## State Placement

- Keep state placement explicit. In immediate mode nothing survives a frame unless it is stored deliberately.
- Persist state that must outlive the frame instead of rebuilding it inside transient UI branches, unless resetting it is the intent.

## Tooltips

- Use `Response::on_hover_ui(...)` instead of `on_hover_text(...)` when the content is computed or formatted, so it is built only on hover.
- Inside `on_hover_ui(...)`, call `ui.set_max_width(ui.spacing().tooltip_width)` before adding content to preserve egui's default tooltip wrapping.

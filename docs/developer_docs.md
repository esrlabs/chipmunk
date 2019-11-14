# create indexer operation with neon binding

## Rust: implement streaming API

Since most operations triggered in chipmunk can take some time (mostly working on big files or
streams), all functions should use events/messages to inform the chipmunk about progress, results,
errors and warnings. Below is a description of how to achieve that.

your function should take 2 additional parameters:

    update_channel: mpsc::Sender<IndexingResults<T>>,
    shutdown_rx: Option<mpsc::Receiver<()>>,

both are rust mpsc channels that can be used for communication between the client using your
function and the function itself. the `update_channel` is the sender-end of a mpsc channel which
means that your function can use it to send messages to the function-user.
So what should/can your function send? There are 2 basic categories of events you should send:
`IndexingProgress<T>` messages or `Notification` messages. We use the `Result` type to make the
distinction. Kind of like the `Either` type in haskell. Either we send an `Ok(event)` or an
`Err(notification)`.

    pub type IndexingResults<T> = std::result::Result<IndexingProgress<T>, Notification>;

In case of an `IndexingProgress`, you can either send an actual result (`GotItem`), or report on the
lifecycle state of the function (indicating progress or the end of the function)

    pub enum IndexingProgress<T> {
        GotItem { item: T },
        Progress { ticks: (usize, usize) },
        Stopped,
        Finished,
    }

Note that for indicating that the function is finished, there are 2 events (`Stopped` and
`Finished`) This is to distinguish between "we were stopped from outside" and "we really did
finish").
For all errors that occure and should be communicated to chipmunk, you can send a `Notification`.
This is a struct that contains the severity, some content and optionally a line number to indicate
at which line the error has occurred.

    pub struct Notification {
        pub severity: Severity,
        pub content: String,
        pub line: Option<usize>,
    }





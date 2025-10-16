/// Events related to general app to be sent from Core to UI.
#[derive(Debug, Clone)]
pub enum AppEvent {
    CreateSession {
        title: String,
    },
    /// Close the application.
    Close,
}

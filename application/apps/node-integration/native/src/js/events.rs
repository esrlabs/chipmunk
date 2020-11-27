#[derive(strum_macros::ToString, Debug)]
pub enum CallbackEvent {
    Progress,
    Notification,
    Done,
}

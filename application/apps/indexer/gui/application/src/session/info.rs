use stypes::ObserveOptions;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: Uuid,
    pub title: String,
}

impl SessionInfo {
    pub fn from_observe_options(id: Uuid, options: &ObserveOptions) -> Self {
        let title = match &options.origin {
            stypes::ObserveOrigin::File(_, _, path) => path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| String::from("Unknown")),
            stypes::ObserveOrigin::Concat(..) => todo!("session info not implemented for concat"),
            stypes::ObserveOrigin::Stream(..) => todo!("session info not implemented for stream"),
        };

        Self { title, id }
    }
}

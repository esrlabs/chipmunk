use std::{path::PathBuf, sync::Arc};

use uuid::Uuid;

/// Preview renderer selected from attachment MIME metadata.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreviewKind {
    /// Display decoded content as text.
    Text,
    /// Display decoded content as an image.
    Image,
    /// MIME type is absent or not supported for preview.
    Unsupported,
}

/// Attachment content converted by the service for UI rendering.
#[derive(Clone)]
pub enum PreviewContent {
    /// Text content decoded from a UTF-8 file.
    Text(String),
    /// Decoded image content and its uploaded rendering texture.
    Image(PreviewImage),
}

/// Shared image data retained for rendering and clipboard submission.
#[derive(Clone)]
pub struct PreviewImage {
    pixels: Arc<egui::ColorImage>,
    texture: egui::TextureHandle,
}

impl PreviewContent {
    /// Submits the complete preview content to the system clipboard.
    pub fn copy_to(&self, ctx: &egui::Context) {
        match self {
            Self::Text(text) => ctx.copy_text(text.clone()),
            Self::Image(image) => ctx.copy_image(image.pixels.as_ref().clone()),
        }
    }
}

impl PreviewImage {
    /// Retains decoded pixels alongside their rendering texture.
    pub fn new(pixels: Arc<egui::ColorImage>, texture: egui::TextureHandle) -> Self {
        Self { pixels, texture }
    }

    /// Returns the texture used to render the preview.
    pub fn texture(&self) -> &egui::TextureHandle {
        &self.texture
    }
}

/// Request sent from UI to service to load and convert one attachment preview.
#[derive(Debug)]
pub struct PreviewRequest {
    /// Attachment identifier used to match service responses with UI selection.
    pub attachment_id: Uuid,
    /// Attachment file path read by the service.
    pub filepath: PathBuf,
    /// Preview conversion selected by the UI from MIME metadata.
    pub kind: PreviewKind,
    /// UI destination that should receive the preview response.
    pub target: PreviewTarget,
}

/// UI destination waiting for an attachment preview response.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreviewTarget {
    /// Compact preview in the attachments side panel.
    SidePanel,
    /// Larger attachment preview modal.
    Modal,
}

/// Returns the preview kind supported for the provided MIME type.
pub fn kind_for_mime(mime: Option<&str>) -> PreviewKind {
    let Some(mime) = mime else {
        return PreviewKind::Unsupported;
    };

    let mime = mime
        .split(';')
        .next()
        .unwrap_or(mime)
        .trim()
        .to_ascii_lowercase();

    if mime.starts_with("text/") {
        return PreviewKind::Text;
    }

    match mime.as_str() {
        "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/bmp" => PreviewKind::Image,
        "application/json"
        | "application/ld+json"
        | "application/xml"
        | "application/xhtml+xml"
        | "application/javascript"
        | "application/x-javascript"
        | "application/toml"
        | "application/yaml"
        | "application/x-yaml"
        | "application/csv"
        | "application/sql" => PreviewKind::Text,
        mime if mime.ends_with("+json") || mime.ends_with("+xml") => PreviewKind::Text,
        _ => PreviewKind::Unsupported,
    }
}

impl std::fmt::Debug for PreviewContent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Text(_) => f.debug_tuple("Text").field(&"...").finish(),
            Self::Image(image) => f
                .debug_struct("Image")
                .field("size", &image.texture.size())
                .finish(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_supported_preview_mimes() {
        assert_eq!(
            kind_for_mime(Some("text/plain; charset=utf-8")),
            PreviewKind::Text
        );
        assert_eq!(
            kind_for_mime(Some("application/vnd.api+json")),
            PreviewKind::Text
        );
        assert_eq!(kind_for_mime(Some("image/png")), PreviewKind::Image);
    }

    #[test]
    fn rejects_unknown_or_missing_mimes() {
        assert_eq!(
            kind_for_mime(Some("application/octet-stream")),
            PreviewKind::Unsupported
        );
        assert_eq!(kind_for_mime(None), PreviewKind::Unsupported);
    }
}

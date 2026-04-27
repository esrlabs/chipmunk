use rustc_hash::FxHashMap;
use stypes::AttachmentInfo;
use uuid::Uuid;

use crate::host::common::colors;

#[derive(Debug, Default)]
pub struct AttachmentsState {
    /// NOTE: Ordered, index-accessible storage is required for egui::ScrollArea::show_rows()
    attachments: Vec<AttachmentInfo>,
    /// Index for lookups: attachment UUID -> attachments list index
    index_by_uuid: FxHashMap<Uuid, usize>,
    /// Index for lookups: log position -> attachments list index
    index_by_position: FxHashMap<usize, usize>,
    /// Available attachment extensions in first-seen order.
    extensions: Vec<String>,
    /// Index for lookups: attachment extension -> associated color
    color_by_extension: FxHashMap<String, egui::Color32>,
    /// Active extension filter and its cached attachment indices.
    filter: Option<AttachmentFilter>,
}

/// Cached attachment indices for the active extension filter.
#[derive(Debug)]
pub struct AttachmentFilter {
    /// Extension currently selected in the filter menu.
    extension: String,
    /// Attachment indices matching the selected extension.
    indices: Vec<usize>,
}

impl AttachmentsState {
    pub fn add(&mut self, attachment: AttachmentInfo) {
        let uuid = attachment.uuid;
        let index = self
            .index_by_uuid
            .get(&attachment.uuid)
            .copied()
            .unwrap_or(self.attachments.len());

        for &position in &attachment.messages {
            self.index_by_position.insert(position, index);
        }

        // Assumption: attachment metadata tied to a UUID does not change on update.
        if self.index_by_uuid.contains_key(&uuid) {
            return;
        }

        self.index_by_uuid.insert(uuid, index);

        if let Some(ext) = attachment.ext.as_deref() {
            if !self.color_by_extension.contains_key(ext) {
                self.extensions.push(ext.to_string());
                self.color_by_extension.insert(
                    ext.to_string(),
                    colors::search_value_color(self.color_by_extension.len()),
                );
            }

            if let Some(filter) = &mut self.filter
                && filter.extension == ext
            {
                filter.indices.push(index);
            }
        }

        self.attachments.push(attachment);
    }

    /// Get all attachments in order.
    pub fn attachments(&self) -> &[AttachmentInfo] {
        &self.attachments
    }

    /// Get attachment by its UUID.
    pub fn attachment_by_uuid(&self, uuid: &Uuid) -> Option<&AttachmentInfo> {
        self.index_by_uuid
            .get(uuid)
            .and_then(|index| self.attachments.get(*index))
    }

    /// Get attachment for a specific log list position.
    pub fn attachment_by_log_position(&self, position: usize) -> Option<&AttachmentInfo> {
        self.index_by_position
            .get(&position)
            .and_then(|index| self.attachments.get(*index))
    }

    /// Get available attachment extensions in first-seen order.
    pub fn extensions(&self) -> &[String] {
        &self.extensions
    }

    /// Get the active extension filter, if set.
    pub fn active_filter(&self) -> Option<&AttachmentFilter> {
        self.filter.as_ref()
    }

    /// Set the active extension filter and rebuild its cached indices.
    pub fn set_extension_filter(&mut self, extension: String) {
        let indices = self
            .attachments
            .iter()
            .enumerate()
            .filter_map(|(index, attachment)| {
                attachment
                    .ext
                    .as_deref()
                    .is_some_and(|ext| ext == extension.as_str())
                    .then_some(index)
            })
            .collect();

        self.filter = Some(AttachmentFilter { extension, indices });
    }

    /// Clear the active extension filter.
    pub fn clear_filter(&mut self) {
        self.filter = None;
    }

    /// Get color for a given file extension.
    pub fn color_by_extension(&self, ext: &str) -> Option<egui::Color32> {
        self.color_by_extension.get(ext).copied()
    }

    /// Get color for a given attachment uuid.
    pub fn color_by_uuid(&self, uuid: &Uuid) -> Option<egui::Color32> {
        self.attachment_by_uuid(uuid)
            .and_then(|attachment| attachment.ext.as_deref())
            .and_then(|ext| self.color_by_extension.get(ext))
            .copied()
    }
}

impl AttachmentFilter {
    /// Get the selected attachment extension.
    pub fn extension(&self) -> &str {
        &self.extension
    }

    /// Get attachment indices matching the selected extension.
    pub fn indices(&self) -> &[usize] {
        &self.indices
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    fn attachment(id: u128, ext: Option<&str>) -> AttachmentInfo {
        AttachmentInfo {
            uuid: Uuid::from_u128(id),
            filepath: PathBuf::from(format!("attachment-{id}")),
            name: format!("attachment-{id}"),
            ext: ext.map(str::to_string),
            size: id as usize,
            mime: None,
            messages: vec![id as usize],
        }
    }

    #[test]
    fn tracks_extensions_once_in_first_seen_order() {
        let mut state = AttachmentsState::default();

        state.add(attachment(1, Some("txt")));
        state.add(attachment(2, Some("png")));
        state.add(attachment(3, Some("txt")));
        state.add(attachment(4, None));

        assert_eq!(state.extensions(), &["txt".to_string(), "png".to_string()]);
    }

    #[test]
    fn filters_existing_and_new_matching_attachments() {
        let mut state = AttachmentsState::default();
        state.add(attachment(1, Some("txt")));
        state.add(attachment(2, Some("png")));
        state.add(attachment(3, Some("txt")));

        state.set_extension_filter("png".to_string());
        assert_eq!(state.active_filter().unwrap().indices(), &[1]);

        state.add(attachment(4, Some("png")));
        state.add(attachment(5, Some("txt")));
        state.add(attachment(6, None));

        let filter = state.active_filter().unwrap();
        assert_eq!(filter.extension(), "png");
        assert_eq!(filter.indices(), &[1, 3]);
    }

    #[test]
    fn duplicate_attachment_update_does_not_duplicate_filter_indices() {
        let mut state = AttachmentsState::default();
        state.add(attachment(1, Some("png")));
        state.set_extension_filter("png".to_string());

        state.add(attachment(1, Some("png")));

        assert_eq!(state.attachments().len(), 1);
        assert_eq!(state.active_filter().unwrap().indices(), &[0]);
    }

    #[test]
    fn clear_filter_removes_active_filter() {
        let mut state = AttachmentsState::default();
        state.add(attachment(1, Some("png")));
        state.set_extension_filter("png".to_string());

        state.clear_filter();

        assert!(state.active_filter().is_none());
    }
}

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
    /// Index for lookups: attachment extension -> associated color
    color_by_extension: FxHashMap<String, egui::Color32>,
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

        // Assumption: index_by_uuid and color_by_extension cannot change when a attachment is updated.
        if self.index_by_uuid.contains_key(&uuid) {
            return;
        }

        self.index_by_uuid.insert(uuid, index);

        if let Some(ext) = attachment.ext.as_deref()
            && !self.color_by_extension.contains_key(ext)
        {
            self.color_by_extension.insert(
                ext.to_string(),
                colors::search_value_color(self.color_by_extension.len()),
            );
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

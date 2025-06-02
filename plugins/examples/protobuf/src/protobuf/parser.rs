use crate::*;
use prost_reflect::{
    DescriptorPool, DynamicMessage, FileDescriptor, MessageDescriptor, prost::Message,
};
use std::{fs, path::Path};

/// A parser for Protocol Buffers (protobuf) messages.
///
/// This parser requires a descriptor file to be provided, which contains the
/// definitions of all possible protobuf messages. Without this file, parsing is not possible.
pub struct ProtobufParser {
    dmsgs: Vec<MessageDescriptor>,
}

impl ProtobufParser {
    /// Creates a new `ProtobufParser` instance.
    ///
    /// # Arguments
    /// * `desc_path` - A path to the protobuf descriptor file.
    ///
    /// # Returns
    /// Returns an instance of `ProtobufParser` if the descriptor file is successfully loaded,
    /// otherwise returns an error.
    pub fn new<P: AsRef<Path>>(desc_path: P) -> Result<Self, E> {
        /// Extracts all message descriptors from a given file descriptor.
        fn get_message(desc: &FileDescriptor) -> Vec<MessageDescriptor> {
            let mut out = Vec::new();

            /// Recursively collects all nested message descriptors.
            fn recurse_message(
                msg_desc: &prost_reflect::MessageDescriptor,
                acc: &mut Vec<prost_reflect::MessageDescriptor>,
            ) {
                acc.push(msg_desc.clone());
                for nested in msg_desc.child_messages() {
                    recurse_message(&nested, acc);
                }
            }

            for msg_desc in desc.messages() {
                recurse_message(&msg_desc, &mut out);
            }
            out
        }

        // Read descriptor file (it may include multiple protobuf definitions)
        let pool = DescriptorPool::decode(fs::read(desc_path)?.as_slice())?;

        // Collect all available message descriptors
        let mut dmsgs = Vec::new();
        for file in pool.files() {
            dmsgs.append(&mut get_message(&file));
        }

        log::debug!("Descriptor includes {} messages", dmsgs.len());
        Ok(Self { dmsgs })
    }

    /// Tries to parse the given binary data as any of the known protobuf messages.
    ///
    /// # Arguments
    /// * `data` - A byte slice containing the serialized protobuf message.
    ///
    /// # Returns
    /// Returns `Some((message_name, len, decoded_message))` if any known message descriptor matches,
    /// otherwise returns `None` if no matches are found.
    pub fn one_of_any(&self, data: &[u8]) -> Option<(String, u64, DynamicMessage)> {
        let mut candidates = self
            .dmsgs
            .iter()
            .filter_map(|dmsg| {
                DynamicMessage::decode(dmsg.clone(), data)
                    .map(|msg| (dmsg.name().to_string(), msg))
                    .ok()
            })
            .collect::<Vec<(String, DynamicMessage)>>();
        // Since protobuf messages are not self-descriptive, multiple matches may occur.
        // Additionally, protobuf messages do not store their own length, so we must estimate
        // the length of decoded messages and select the one that consumes the maximum bytes.
        // If multiple messages have the same maximum length, we should return all descriptor names.
        if let Some(max_coverage) = candidates.iter().map(|(_, msg)| msg.encoded_len()).max() {
            candidates.retain(|(_, msg)| msg.encoded_len() == max_coverage);
            let names = candidates
                .iter()
                .map(|(mn, ..)| mn.to_owned())
                .collect::<Vec<String>>()
                .join(", ");
            candidates
                .pop()
                .map(|(.., msg)| (names, max_coverage as u64, msg))
        } else {
            None
        }
    }
}

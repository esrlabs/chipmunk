use super::CommonDescriptor;

/// Defines source-specific capabilities and behaviors.
///
/// This trait extends [`CommonDescriptor`] to describe features unique to data sources.
/// One such feature is support for SDE (Source Data Exchange), which allows the user
/// to send data back into the source instance. This is typically applicable in interactive
/// or bidirectional sources.
///
/// For example, a `SerialPort` source may support SDE, enabling users to send commands
/// directly to the serial device.
pub trait SourceDescriptor: CommonDescriptor {
    /// Indicates whether the source supports Source Data Exchange (SDE).
    ///
    /// When SDE is supported, the system allows the user to transmit data to the source,
    /// such as sending raw binary streams or textual commands.
    ///
    /// This is commonly used in sources that enable two-way communication.
    /// If the source does not support SDE, this method should return `false`.
    ///
    /// # Arguments
    ///
    /// * `_origin` - The session action that triggered the check (e.g., from the UI or script).
    /// * `_fields` - A list of fields relevant to the current context or form submission.
    ///
    /// # Returns
    ///
    /// `true` if SDE is supported by the source, `false` otherwise.
    fn is_sde_supported(&self, _origin: &stypes::SessionAction) -> bool {
        false
    }
}

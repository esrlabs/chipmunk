use super::CommonDescriptor;

/// This trait fully defines a source entity (as it inherits the implementation of auxiliary traits)
/// and is used by the `Register` to store source descriptors.
///
/// ## Design Note
///
/// In one of the earlier implementations, there was an attempt to separate the factory method (`create`)
/// into an independent entity. In other words, instead of storing
/// `HashMap<..., Box<dyn ParserFactory>>` in the `Register`, the idea was to store
/// `HashMap<..., (FactoryFnPointer, Box<dyn SourceDescriptor>)>` - i.e., separating the factory from the descriptor.
///
/// This approach has clear drawbacks:
/// - First, it breaks the relationship between the `SourceDescriptor` and the factory. For example,
///   the compiler would not raise an error if a tcp source is registered with a descriptor
///   meant for a serial source.
/// - Second (and more critically), it prevents passing `self` into the factory method, which is essential
///   both for proper error validation and for cases where the descriptor itself contains
///   key information required for source instantiation. This is especially relevant for plugins,
///   where the physical path to the plugin file (stored in the descriptor) must be accessible to the factory.
///
/// Due to these factors, the decision was made to return to the original design, where the factory
/// is represented as a trait tightly coupled with the rest of the descriptor logic.
///
/// ## Generic Type
///
/// The trait is generic over type `T`, which always refers to the `sources::Sources` type.
/// The use of a generic parameter here serves only one purpose: to avoid cyclic dependencies
/// within the solution, while also preventing the need to excessively split the codebase
/// into small crates.
pub trait SourceFactory<T>: SourceDescriptor {
    fn create(
        &self,
        origin: &stypes::SessionAction,
        options: &[stypes::Field],
    ) -> Result<Option<(T, Option<String>)>, stypes::NativeError>;
}

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

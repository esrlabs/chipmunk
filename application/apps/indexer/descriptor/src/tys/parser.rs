use super::CommonDescriptor;

/// This trait fully defines a parser entity (as it inherits the implementation of auxiliary traits)
/// and is used by the `Register` to store parser descriptors.
///
/// ## Design Note
///
/// In one of the earlier implementations, there was an attempt to separate the factory method (`create`)
/// into an independent entity. In other words, instead of storing
/// `HashMap<..., Box<dyn ParserFactory>>` in the `Register`, the idea was to store
/// `HashMap<..., (FactoryFnPointer, Box<dyn ParserDescriptor>)>` - i.e., separating the factory from the descriptor.
///
/// This approach has clear drawbacks:
/// - First, it breaks the relationship between the `ParserDescriptor` and the factory. For example,
///   the compiler would not raise an error if a textual parser is registered with a descriptor
///   meant for a DLT parser.
/// - Second (and more critically), it prevents passing `self` into the factory method, which is essential
///   both for proper error validation and for cases where the descriptor itself contains
///   key information required for parser instantiation. This is especially relevant for plugins,
///   where the physical path to the plugin file (stored in the descriptor) must be accessible to the factory.
///
/// Due to these factors, the decision was made to return to the original design, where the factory
/// is represented as a trait tightly coupled with the rest of the descriptor logic.
///
/// ## Generic Type
///
/// The trait is generic over type `T`, which always refers to the `parsers::Parsers` type.
/// The use of a generic parameter here serves only one purpose: to avoid cyclic dependencies
/// within the solution, while also preventing the need to excessively split the codebase
/// into small crates.
pub trait ParserFactory<T>: ParserDescriptor {
    fn create(
        &self,
        origin: &stypes::SessionAction,
        options: &[stypes::Field],
    ) -> Result<Option<(T, Option<String>)>, stypes::NativeError>;
}

/// Defines parser-specific behavior and capabilities.
///
/// This trait extends [`CommonDescriptor`] and provides an interface for
/// describing rendering behavior specific to a parser implementation.
///
/// A parser may define which render should be used to display its content.
/// However, not all parsers are intended for rendering; some may serve
/// other purposes such as exporting or transforming data and thus return `None`
/// instead of a rendering strategy.
///
/// Implementors of this trait should document the semantics of `get_render()`
/// in the context of their specific parser functionality.
pub trait ParserDescriptor: CommonDescriptor {
    /// Returns the rendering strategy associated with this parser, if any.
    ///
    /// This method determines how (and whether) the parser's output should be
    /// rendered in the user interface. If the parser is not intended to produce
    /// visual output-e.g., when used for data export or structural analysis-
    /// this function returns `None`.
    ///
    /// # Returns
    ///
    /// - `Some(OutputRender)` if the parser provides a specific rendering strategy.
    /// - `None` if rendering is not applicable to this parser.
    fn get_render(&self) -> Option<stypes::OutputRender>;
}

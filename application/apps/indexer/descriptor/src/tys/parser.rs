use super::CommonDescriptor;

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

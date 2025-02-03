use parsers::dlt::DltParser;

/// Creates new [`DltParser`] instance with the given arguments.
///
/// * `with_header`: Sets if each input message should start with a header.
pub fn create_parser<'a>(with_header: bool) -> DltParser<'a> {
    DltParser::new(None, None, None, None, with_header)
}

use crate::events::NativeError;
use parsers::{dlt, dlt::DltParser, text::StringTokenizer, LogMessage, Parser};
use sources::factory::DltParserSettings;

pub fn text<T: LogMessage>() -> Result<Box<impl Parser<T>>, NativeError>
where
    StringTokenizer: Parser<T>,
{
    Ok(Box::new(StringTokenizer))
}

pub fn dlt<'a, T: LogMessage>(
    settings: &'a DltParserSettings,
    fibex_metadata: Option<&'a dlt::FibexMetadata>,
) -> Result<Box<impl Parser<T> + 'a>, NativeError>
where
    DltParser<'a>: Parser<T> + 'a,
{
    let parser = dlt::DltParser::new(
        settings.filter_config.as_ref().map(|f| f.into()),
        fibex_metadata,
        settings.with_storage_header,
    );
    Ok(Box::new(parser))
}

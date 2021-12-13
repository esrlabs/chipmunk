use crate::{Error, LogMessage, Parser};
use dlt_core::{
    dlt, fibex::FibexMetadata, filtering::ProcessedDltFilterConfig, fmt::FormattableMessage,
    parse::dlt_message,
};

impl LogMessage for FormattableMessage<'_> {
    fn as_stored_bytes(&self) -> Vec<u8> {
        self.message.as_bytes()
    }
}

pub struct DltParser<'m> {
    pub filter_config: Option<ProcessedDltFilterConfig>,
    pub fibex_metadata: Option<&'m FibexMetadata>,
}

impl<'m> Parser<FormattableMessage<'m>> for DltParser<'m> {
    fn parse<'b>(
        &self,
        input: &'b [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<FormattableMessage<'m>>), Error> {
        let (rest, message) = match dlt_message(input, self.filter_config.as_ref(), false)
            .map_err(|e| Error::Parse(format!("{}", e)))?
        {
            (rest, dlt_core::parse::ParsedMessage::FilteredOut(_n)) => (rest, None),

            (rest, dlt_core::parse::ParsedMessage::Invalid) => (rest, None),
            (rest, dlt_core::parse::ParsedMessage::Item(i)) => {
                let msg_with_storage_header = i.add_storage_header(
                    timestamp.map(|time| dlt::DltTimeStamp::from_ms(time as u64)),
                );
                let msg = FormattableMessage {
                    message: msg_with_storage_header,
                    fibex_metadata: self.fibex_metadata,
                };
                (rest, Some(msg))
            }
        };
        Ok((rest, message))
    }
}

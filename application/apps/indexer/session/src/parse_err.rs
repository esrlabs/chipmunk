use parsers::{someip::SomeipParser, LogMessage, ParseLogError, Parser};

#[derive(Default)]
pub struct ParseErrorReslover {
    someip_praser: Option<SomeipParser>,
}

impl ParseErrorReslover {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets SomeIP  parser on the resolver
    pub fn with_someip_parser(&mut self, someip_praser: SomeipParser) -> &mut Self {
        self.someip_praser = Some(someip_praser);
        self
    }

    /// Tries to resolve the given error returning the parsed string if succeeded.
    pub fn resolve_err(&mut self, error: &ParseLogError) -> Option<String> {
        match error.resolve_hint {
            Some(parsers::ResolveErrorHint::SomeIP) => self
                .someip_praser
                .as_mut()
                .and_then(|parser| {
                    parser
                        .parse(&error.remain_bytes, None)
                        .ok()
                        .and_then(|res| res.1)
                })
                .and_then(|a| match a {
                    // TODO: Handle someip parser errors after prototyping.
                    parsers::ParseYield::Message(msg) => Some(msg.to_text().msg),
                    parsers::ParseYield::Attachment(_) => None,
                    parsers::ParseYield::MessageAndAttachment((msg, _att)) => {
                        Some(msg.to_text().msg)
                    }
                }),
            None => None,
        }
    }
}

/// Get the text message of [`LogMessage`], resolving parse text errors if possible,
/// TODO: Otherwise it should save the error to the faulty messages store, which need to be
/// implemented as well :)
pub fn get_log_text(item: impl LogMessage, err_resolver: &mut ParseErrorReslover) -> String {
    let text_res = item.to_text();
    if item.can_error() {
        let mut msg = text_res.msg;
        if let Some(err_info) = text_res.error {
            match err_resolver.resolve_err(&err_info) {
                Some(resloved_msg) => {
                    msg.push_str(&resloved_msg);
                }
                None => {
                    //TODO: Item with error details should be reported faulty messages store.
                    msg = format!("{msg}: Unknow Error bytes: {:?}", err_info.remain_bytes);
                }
            }
        }
        msg
    } else {
        text_res.msg
    }
}

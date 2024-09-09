use parsers::{someip::SomeipParser, LogMessage, Parser, TemplateLogMsg};

#[derive(Default)]
pub struct ParseRestReslover {
    someip_praser: Option<SomeipParser>,
}

impl ParseRestReslover {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets SomeIP  parser on the resolver
    pub fn with_someip_parser(&mut self, someip_praser: SomeipParser) -> &mut Self {
        self.someip_praser = Some(someip_praser);
        self
    }

    /// Tries to resolve the given error returning the parsed string if succeeded.
    pub fn resolve_log_template(&mut self, template: &mut TemplateLogMsg) -> Option<String> {
        for hint in template.get_resolve_hints() {
            match hint {
                parsers::ResolveParseHint::SomeIP => {
                    if let Some(p) = self.someip_praser.as_mut() {
                        let res = template.try_resolve(|bytes| {
                            let p_yield = p.parse(bytes, None).ok()?.1?;
                            match p_yield {
                                parsers::ParseYield::Message(item) => match item.try_resolve() {
                                    parsers::LogMessageContent::Text(msg) => Some(msg),
                                    // Ignore nested errors for now
                                    parsers::LogMessageContent::Template(_) => None,
                                },
                                // Ignore other parse types for now
                                parsers::ParseYield::Attachment(_) => None,
                                parsers::ParseYield::MessageAndAttachment(_) => None,
                            }
                        });

                        if res.is_some() {
                            return res;
                        }
                    }
                }
            }
        }
        None
    }
}

/// Get the text message of [`LogMessage`], resolving its rest payloads if existed when possible,
/// TODO: Otherwise it should save the error to the faulty messages store, which need to be
/// implemented as well :)
pub fn resolve_log_msg<T: LogMessage>(item: T, err_resolver: &mut ParseRestReslover) -> String {
    match item.try_resolve() {
        parsers::LogMessageContent::Text(msg) => msg,
        parsers::LogMessageContent::Template(mut template) => {
            if let Some(resolved) = err_resolver.resolve_log_template(&mut template) {
                return resolved;
            }
            //TODO: Add message to the faulty messages once implemented.
            template.resolve_lossy()
        }
    }
}

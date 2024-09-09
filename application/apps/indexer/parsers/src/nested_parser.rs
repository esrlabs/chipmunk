use std::convert::Infallible;

use crate::GeneralParseLogError;
use crate::ParseLogMsgError;
use crate::ParseLogSeverity;
use crate::Parser;
use crate::{someip::SomeipParser, LogMessage, ParseYield, ResolveParseHint};

#[derive(Default)]
pub struct ParseRestResolver {
    someip_praser: Option<SomeipParser>,
}

impl ParseRestResolver {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets SomeIP  parser on the resolver
    pub fn with_someip_parser(&mut self, someip_praser: SomeipParser) -> &mut Self {
        self.someip_praser = Some(someip_praser);
        self
    }

    /// Tries to resolve the given error returning the parsed string if succeeded.
    pub fn try_resolve(
        &mut self,
        bytes: &[u8],
        resolve_hint: ResolveParseHint,
    ) -> Option<Result<String, impl ParseLogMsgError>> {
        match resolve_hint {
            ResolveParseHint::SomeIP => {
                let parser = self.someip_praser.as_mut()?;
                //TODO: Proper error handling for parser return
                let p_yield = match parser.parse(bytes, None) {
                    Ok(res) => res.1?,
                    Err(err) => {
                        let err = GeneralParseLogError::from_parser_err(
                            bytes,
                            ParseLogSeverity::Error,
                            err,
                        );

                        return Some(Err(err));
                    }
                };
                match p_yield {
                    ParseYield::Message(item) => {
                        let res = match item.try_resolve(Some(self)) {
                            Ok(parsed) => parsed,
                            Err(err) => {
                                if cfg!(debug_assertions) {
                                    ensure_infalliable(err);
                                }
                                panic!("Infallible Error can't be created")
                            }
                        };

                        Some(Ok(res.to_string()))
                    }
                    // Ignore other parse types for now
                    ParseYield::Attachment(_) | ParseYield::MessageAndAttachment(_) => {
                        let err = GeneralParseLogError::new(
                            format!("{bytes:?}"),
                            "Found attachment in nested payload".into(),
                            ParseLogSeverity::Error,
                        );
                        Some(Err(err))
                    }
                }
            }
        }
    }
}

// Ensure the type of given argument is Infallible, raising a compile time error if not.
fn ensure_infalliable(_err: Infallible) {}

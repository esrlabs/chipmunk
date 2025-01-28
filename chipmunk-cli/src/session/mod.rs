use std::path::PathBuf;

use parsers::{LogMessage, Parser};
use sources::ByteSource;

// TODO AAZ:
pub async fn run_session<T, P, D>(
    parser: P,
    bytesource: D,
    output: Option<PathBuf>,
) -> anyhow::Result<()>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
{
    todo!()
}

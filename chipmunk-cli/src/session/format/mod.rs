use parsers::LogMessage;

pub mod binary;
pub mod text;

/// Format the message and then write it to the provided. [`std::io::Write`]
pub trait MessageWriter {
    fn write_msg(
        &mut self,
        writer: impl std::io::Write,
        msg: impl LogMessage,
    ) -> anyhow::Result<()>;
}

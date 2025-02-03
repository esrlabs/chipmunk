use clap::Parser as _;
use cli_args::OutputFormat;
use tokio_util::sync::CancellationToken;

use session::{
    format::{binary::BinaryMessageWriter, text::MessageTextWriter},
    start_session,
};

mod cli_args;
mod session;

pub async fn run_app(cancel_token: CancellationToken) -> anyhow::Result<()> {
    let cli = cli_args::Cli::parse();
    cli.validate()?;

    match cli.parser {
        cli_args::Parser::Dlt { fibex_files, input } => {
            let with_storage_header = match &input {
                cli_args::InputSource::Tcp { .. } | cli_args::InputSource::Udp { .. } => false,
                cli_args::InputSource::File { .. } => true,
            };

            let fibex_metadata = session::parser::dlt::create_fibex_metadata(fibex_files);

            let parser = parsers::dlt::DltParser::new(
                None,
                fibex_metadata.as_ref(),
                None,
                None,
                with_storage_header,
            );

            match cli.output_format {
                OutputFormat::Binary => {
                    let msg_writer = BinaryMessageWriter::default();

                    start_session(parser, input, msg_writer, cli.output_path, cancel_token).await?;
                }
                OutputFormat::Text => {
                    let msg_writer =
                        MessageTextWriter::new(cli.text_columns_separator, cli.text_args_separator);

                    start_session(parser, input, msg_writer, cli.output_path, cancel_token).await?;
                }
            };
        }
    }

    Ok(())
}

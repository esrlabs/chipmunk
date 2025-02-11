use clap::Parser as _;
use cli_args::OutputFormat;
use tokio_util::sync::CancellationToken;

use session::{
    format::{binary::MsgBinaryFormatter, text::MsgTextFormatter},
    start_session,
};

mod cli_args;
mod session;

/// Runs the app parsing and validating the arguments, then starting the matching
/// session keeping track to cancel calls provided by [`cancel_token`].
pub async fn run_app(cancel_token: CancellationToken) -> anyhow::Result<()> {
    let cli = cli_args::Cli::parse();
    cli.validate()?;

    match cli.parser {
        cli_args::Parser::Dlt { fibex_files, input } => {
            // Create DLT parser.
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

            // Move to next part initializing the input source and starting the session.
            match cli.output_format {
                OutputFormat::Binary => {
                    let binary_formatter = MsgBinaryFormatter::default();

                    start_session(
                        parser,
                        input,
                        binary_formatter,
                        cli.output_path,
                        cancel_token,
                    )
                    .await?;
                }
                OutputFormat::Text => {
                    use parsers::dlt::fmt;
                    let text_formatter = MsgTextFormatter::new(
                        fmt::DLT_COLUMN_SENTINAL,
                        fmt::DLT_ARGUMENT_SENTINAL,
                        cli.text_columns_separator,
                        cli.text_args_separator,
                    );

                    start_session(parser, input, text_formatter, cli.output_path, cancel_token)
                        .await?;
                }
            };
        }
    }

    Ok(())
}

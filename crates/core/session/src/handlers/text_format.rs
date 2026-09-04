//! Encoding detection for text sources, shared by the handlers which frame text into lines.
//!
//! Observing and raw export both parse the same bytes and must agree on where the lines are, so
//! both pick their tokenizer from the result of this detection.

use tokio::select;
use tokio_util::sync::CancellationToken;

use parsers::text::TextFormat;
use sources::{ByteSource, sde::SdeReceiver};

/// Determines how the text of `source` is encoded, from the bytes of its first load.
///
/// Those bytes stay in the source buffer for the caller to parse; only a byte order mark is
/// consumed here, since it marks the input and is not part of its first line.
///
/// One load is all the evidence there is: a source which delivers too few bytes to decide, or
/// none at all, is read as UTF-8, which is decoded lossily and stays readable either way.
/// Nothing is lost by deciding on too little, the caller loads the same bytes again.
///
/// Waiting ends as soon as data is exchanged with the source, which gives up detection on
/// sources that speak only after being written to: their first bytes are an answer to a write
/// this function must not hold back, and one load of them would be poor evidence anyway.
///
/// # Return:
/// The format to read the source with, or `None` when the operation was cancelled while waiting
/// for the first bytes.
pub async fn sniff_text_format<S: ByteSource>(
    source: &mut S,
    rx_sde: Option<&mut SdeReceiver>,
    cancel: &CancellationToken,
) -> Result<Option<TextFormat>, stypes::NativeError> {
    select! {
        // `load()` is cancel safe, so the bytes which did arrive stay in the source buffer no
        // matter which arm wins.
        load_result = source.load(None) => { load_result?; },

        // Serving the message here is what keeps an interactive source usable: the producer
        // loop, which normally answers it, is only entered once this function returns.
        Some((msg, tx_response)) = async {
            match rx_sde {
                Some(rx_sde) => rx_sde.recv().await,
                None => None,
            }
        } => {
            let sde_res = source.income(msg).await.map_err(|err| err.to_string());
            if tx_response.send(sde_res).is_err() {
                log::warn!("Fail to send back message from source");
            }
        },

        _ = cancel.cancelled() => return Ok(None),
    };

    let format = TextFormat::sniff(source.current_slice());
    source.consume(format.bom_len);

    Ok(Some(format))
}

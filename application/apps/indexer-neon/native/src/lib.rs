extern crate dlt;
extern crate indexer_base;
extern crate neon;
#[macro_use]
extern crate log;
extern crate crossbeam_channel;
extern crate dirs;
extern crate log4rs;
extern crate merging;
extern crate processor;
extern crate serde;

mod channels;
mod config;
mod fibex_utils;
mod js;
mod logging;
use crate::js::session::JsRustSession;
use logging::init_logging;

// use api::{
//     concatenatination::JsConcatenatorEmitter, dlt_indexing::JsDltIndexerEventEmitter,
//     dlt_pcap::JsDltPcapEventEmitter, dlt_sockets::JsDltSocketEventEmitter,
//     dlt_stats::JsDltStatsEventEmitter, exporting::JsExporterEventEmitter,
//     format_verification::JsFormatVerificationEmitter, indexing::JsIndexerEventEmitter,
//     line_grabbing::JsGrabber, merging::JsMergerEmitter,
//     timestamp_detector::detect_timestamp_in_string,
//     timestamp_detector::JsTimestampFormatDetectionEmitter,
//     timestamp_extractor::JsTimestampExtractEmitter,
// };
use neon::prelude::*;

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    #[allow(clippy::empty_loop)]
    loop {}
}

register_module!(mut cx, {
    init_logging().expect("logging has to be cofigured");

    // expose synchronous API functions
    // cx.export_function("detectTimestampInString", detect_timestamp_in_string)?;

    // expose asynchronous APIs (event emitters)
    // cx.export_class::<JsIndexerEventEmitter>("RustIndexerEventEmitter")?;
    // cx.export_class::<JsDltIndexerEventEmitter>("RustDltIndexerEventEmitter")?;
    // cx.export_class::<JsDltPcapEventEmitter>("RustDltPcapEventEmitter")?;
    // cx.export_class::<JsDltPcapConverterEventEmitter>("RustDltPcapConverterEventEmitter")?;
    // cx.export_class::<JsDltStatsEventEmitter>("RustDltStatsEventEmitter")?;
    // cx.export_class::<JsDltSocketEventEmitter>("RustDltSocketEventEmitter")?;
    // cx.export_class::<JsTimestampFormatDetectionEmitter>("RustTimestampFormatDetectionEmitter")?;
    // cx.export_class::<JsTimestampExtractEmitter>("RustTimestampExtractEmitter")?;
    // cx.export_class::<JsConcatenatorEmitter>("RustConcatenatorEmitter")?;
    // cx.export_class::<JsMergerEmitter>("RustMergerEmitter")?;
    // cx.export_class::<JsExporterEventEmitter>("RustExporterEventEmitter")?;
    // cx.export_class::<JsFormatVerificationEmitter>("RustFormatVerificationEmitter")?;
    // cx.export_class::<JsGrabber>("RustGrabber")?;

    // API v2.1
    cx.export_class::<JsRustSession>("RustSession")?;

    Ok(())
});

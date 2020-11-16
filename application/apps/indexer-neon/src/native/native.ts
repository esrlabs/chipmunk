
export function getNativeModule() {
    const native = require("../../../../native/index.node");
    return native;
}

const {
    // RustIndexerEventEmitter: RustIndexerChannel,
    // RustDltIndexerEventEmitter: RustDltIndexerChannel,
    // RustDltStatsEventEmitter: RustDltStatsChannel,
    // RustExporterEventEmitter: RustExportFileChannel,
    // RustDltSocketEventEmitter: RustDltSocketChannel,
    // RustDltPcapEventEmitter: RustDltPcapChannel,
    // RustTimestampFormatDetectionEmitter: RustTimestampChannel,
    // RustTimestampExtractEmitter: RustTimestampExtractChannel,
    // RustFormatVerificationEmitter: RustFormatVerificationChannel,
    // RustConcatenatorEmitter: RustConcatenatorChannel,
    // RustMergerEmitter: RustMergerChannel,
    // RustGrabber: RustGrabberChannel,
    RustSession: RustSessionChannelNoType,
    RustAppendOperation: RustAppendOperationChannelNoType,
} = getNativeModule();

const addon = getNativeModule();

// Reassign types


export {
    // RustIndexerChannel,
    // RustDltIndexerChannel,
    // RustDltStatsChannel,
    // RustExportFileChannel,
    // RustDltSocketChannel,
    // RustDltPcapChannel,
    // RustTimestampChannel,
    // RustTimestampExtractChannel,
    // RustFormatVerificationChannel,
    // RustConcatenatorChannel,
    // RustMergerChannel,
    // RustGrabberChannel,
    RustSessionChannelNoType,
    RustAppendOperationChannelNoType,
    addon
};
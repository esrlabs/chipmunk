
export function getNativeModule() {
    const native = require("../../../../native/index.node");
    return native;
}

const {
    // RustIndexerEventEmitter: RustIndexerChannel,                 // into append
    // RustDltIndexerEventEmitter: RustDltIndexerChannel,           // into append
    // RustDltStatsEventEmitter: RustDltStatsChannel,               
    // RustExporterEventEmitter: RustExportFileChannel,             // channel
    // RustDltSocketEventEmitter: RustDltSocketChannel,
    // RustDltPcapEventEmitter: RustDltPcapChannel,                 // into append
    // RustTimestampFormatDetectionEmitter: RustTimestampChannel,   // channel   
    // RustTimestampExtractEmitter: RustTimestampExtractChannel,    // channel
    // RustFormatVerificationEmitter: RustFormatVerificationChannel,// synch
    // RustConcatenatorEmitter: RustConcatenatorChannel,            // channel
    // RustMergerEmitter: RustMergerChannel,                        // channel
    // RustGrabber: RustGrabberChannel,                             // synch
    RustEmitterEvents: RustEmitterEvents,
    RustSession: RustSessionChannelNoType,
    RustAppendOperation: RustAppendOperationChannelNoType,
    RustMergeOperation: RustMergeOperationChannelNoType,
    RustTimeFormatDetectOperation: RustTimeFormatDetectOperationChannelNoType,
    RustTimeFormatExtractOperation: RustTimeFormatExtractOperationChannelNoType,
    RustExportOperation: RustExportOperationChannelNoType,
    RustConcatOperation: RustConcatOperationChannelNoType,
    RustSearchOperation: RustSearchOperationChannelNoType,
} = getNativeModule();

const addon = getNativeModule();

export enum ERustEmitterEvents {
    error = 'error',
    destroyed = 'destroyed',
    ready = 'ready',
}

export type TEventEmitter = (name: ERustEmitterEvents, data: any) => void;

export type RustChannelConstructorImpl<T> = new (emitter: TEventEmitter) => T;

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
    RustEmitterEvents,
    RustSessionChannelNoType,
    RustAppendOperationChannelNoType,
    RustMergeOperationChannelNoType,
    RustConcatOperationChannelNoType,
    RustTimeFormatDetectOperationChannelNoType,
    RustTimeFormatExtractOperationChannelNoType,
    RustExportOperationChannelNoType,
    RustSearchOperationChannelNoType,
    addon
};
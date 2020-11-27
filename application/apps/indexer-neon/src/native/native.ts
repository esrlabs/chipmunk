export interface IRustModuleExports {
    RustEmitterEvents: any;
    RustSession: any;
    RustAppendOperation: any;
    RustMergeOperation: any;
    RustTimeFormatDetectOperation: any;
    RustTimeFormatExtractOperation: any;
    RustExportOperation: any;
    RustConcatOperation: any;
    RustSearchOperation: any;
}
export function getNativeModule(): IRustModuleExports {
    // const native = require("../../native/index.node");
    return {
        RustEmitterEvents: {},
        RustSession: {},
        RustAppendOperation: {},
        RustMergeOperation: {},
        RustTimeFormatDetectOperation: {},
        RustTimeFormatExtractOperation: {},
        RustExportOperation: {},
        RustConcatOperation: {},
        RustSearchOperation: {},
    };
}

const {
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
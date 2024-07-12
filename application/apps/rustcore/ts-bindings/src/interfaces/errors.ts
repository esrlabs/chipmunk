import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { error } from 'protocol';
import { error as e } from 'platform/log/utils';

export enum Type {
    NotImplemented = 'NotImplemented',
    InvalidInput = 'InvalidInput',
    InvalidOutput = 'InvalidOutput',
    GrabbingSearch = 'GrabbingSearch',
    GrabbingContent = 'GrabbingContent',
    ParsingContentChunk = 'ParsingContentChunk',
    ParsingSearchChunk = 'ParsingSearchChunk',
    CancelationError = 'CancelationError',
    ContentManipulation = 'ContentManipulation',
    Communication = 'Communication',
    DestinationPath = 'DestinationPath',
    Grabbing = 'Grabbing',
    InvalidArgs = 'InvalidArgs',
    InvalidData = 'InvalidData',
    IoOperation = 'IoOperation',
    MultipleInitCall = 'MultipleInitCall',
    NativeError = 'NativeError',
    OperationNotSupported = 'OperationNotSupported',
    Process = 'Process',
    Protocol = 'Protocol',
    Sde = 'Sde',
    SearchError = 'SearchError',
    SessionCreatingFail = 'SessionCreatingFail',
    SessionUnavailable = 'SessionUnavailable',
    Unrecognized = 'Unrecognized',
    Other = 'Other',
}

export enum Source {
    Assign = 'Assign',
    Search = 'Search',
    SearchValues = 'SearchValues',
    GetMap = 'GetMap',
    ExtractMatchesValues = 'ExtractMatchesValues',
    GrabStreamChunk = 'GrabStreamChunk',
    GrabSearchChunk = 'GrabSearchChunk',
    GetSocketPath = 'GetSocketPath',
    GetNearestTo = 'GetNearestTo',
    GetStreamLen = 'GetStreamLen',
    GetSearchLen = 'GetSearchLen',
    GetFilters = 'GetFilters',
    GetSourcesDefinitions = 'GetSourcesDefinitions',
    GetOperationsStat = 'GetOperationsStat',
    SetDebug = 'SetDebug',
    SendIntoSde = 'SendIntoSde',
    GetAttachments = 'GetAttachments',
    Concat = 'Concat',
    Merge = 'Merge',
    Extract = 'Extract',
    Export = 'Export',
    Detect = 'Detect',
    Abort = 'Abort',
    Sleep = 'Sleep',
    TriggerStateError = 'TriggerStateError',
    TriggerTrackerError = 'TriggerTrackerError',
    AddBookmark = 'AddBookmark',
    SetBookmarks = 'SetBookmarks',
    RemoveSelection = 'RemoveSelection',
    AddSelection = 'AddSelection',
    RemoveBookmark = 'RemoveBookmark',
    ExpandBreadcrumbs = 'ExpandBreadcrumbs',
    SetIndexingMode = 'SetIndexingMode',
    GetIndexedLen = 'GetIndexedLen',
    getAroundIndexes = 'getAroundIndexes',
    Native = 'Native',
    Other = 'Other',
}

export class NativeError extends Error {
    private readonly _type: Type;
    private readonly _source: Source;
    private readonly _native: any;
    private readonly _logger: Logger = scope.getLogger(`NativeError`);

    public static from(smth: any): NativeError {
        try {
            if (smth instanceof Error) {
                return new NativeError(smth, Type.Other, Source.Other);
            } else if (smth instanceof Array) {
                const deserialized = error.ComputationError.deserialize(Uint8Array.from(smth));
                deserialized;
                console.log(deserialized);
                if (deserialized.has_communication) {
                    return new NativeError(
                        new Error(deserialized.communication.message),
                        Type.Communication,
                        Source.Native,
                    );
                } else if (deserialized.has_destination_path) {
                    return new NativeError(
                        new Error(`Destination path error`),
                        Type.Communication,
                        Source.Native,
                    );
                } else if (deserialized.has_grabbing) {
                    return new NativeError(
                        new Error(deserialized.grabbing.toString()),
                        Type.Grabbing,
                        Source.Native,
                    );
                } else if (deserialized.has_invalid_args) {
                    return new NativeError(
                        new Error(deserialized.invalid_args.message),
                        Type.InvalidArgs,
                        Source.Native,
                    );
                } else if (deserialized.has_invalid_data) {
                    return new NativeError(
                        new Error(`Invalid data`),
                        Type.InvalidData,
                        Source.Native,
                    );
                } else if (deserialized.has_io_operation) {
                    return new NativeError(
                        new Error(deserialized.io_operation.message),
                        Type.IoOperation,
                        Source.Native,
                    );
                } else if (deserialized.has_multiple_init_call) {
                    return new NativeError(
                        new Error(`Mutliple calls init`),
                        Type.MultipleInitCall,
                        Source.Native,
                    );
                } else if (deserialized.has_native_error) {
                    return new NativeError(
                        new Error(deserialized.native_error.toString()),
                        Type.NativeError,
                        Source.Native,
                    );
                } else if (deserialized.has_operation_not_supported) {
                    return new NativeError(
                        new Error(deserialized.operation_not_supported.message),
                        Type.OperationNotSupported,
                        Source.Native,
                    );
                } else if (deserialized.has_process) {
                    return new NativeError(
                        new Error(deserialized.process.message),
                        Type.Process,
                        Source.Native,
                    );
                } else if (deserialized.has_protocol) {
                    return new NativeError(
                        new Error(deserialized.protocol.message),
                        Type.Protocol,
                        Source.Native,
                    );
                } else if (deserialized.has_sde) {
                    return new NativeError(
                        new Error(deserialized.sde.message),
                        Type.Sde,
                        Source.Native,
                    );
                } else if (deserialized.has_search_error) {
                    return new NativeError(
                        new Error(deserialized.search_error.toString()),
                        Type.SearchError,
                        Source.Native,
                    );
                } else if (deserialized.has_session_creating_fail) {
                    return new NativeError(
                        new Error(`Fail to create a session`),
                        Type.SessionCreatingFail,
                        Source.Native,
                    );
                } else if (deserialized.has_session_unavailable) {
                    return new NativeError(
                        new Error(`Session unavailable`),
                        Type.SessionUnavailable,
                        Source.Native,
                    );
                } else {
                    return new NativeError(
                        new Error(`Fail to recognize error: ${JSON.stringify(deserialized)}`),
                        Type.Unrecognized,
                        Source.Native,
                    );
                }
            } else if (typeof smth === 'string') {
                return new NativeError(
                    new Error(`${smth}`),
                    Type.Unrecognized,
                    Source.Other,
                    JSON.parse(smth),
                );
            } else {
                return new NativeError(
                    new Error(`Unrecognized error: ${JSON.stringify(smth)}`),
                    Type.Unrecognized,
                    Source.Other,
                );
            }
        } catch (err) {
            return new NativeError(
                new Error(`Err: ${JSON.stringify(smth)} cannot be parsed: ${e(err)}`),
                Type.Unrecognized,
                Source.Other,
            );
        }
    }

    constructor(error: Error, kind: Type, source: Source, native?: any) {
        super(error.message);
        this.stack = error.stack;
        this._type = kind;
        this._source = source;
        this._native = native;
        this.log();
    }

    public getType(): Type {
        return this._type;
    }

    public getSource(): Source {
        return this._source;
    }

    public log(): void {
        this._logger.error(
            `\n\ttype: ${this.getType()};\n\tsource: ${this.getSource()};\n\tmessage: ${
                this.message
            }`,
        );
    }
}

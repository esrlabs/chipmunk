import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';

import * as utils from 'platform/log/utils';
import * as protocol from 'protocol';

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
    Decoding = 'Decoding',
    Encoding = 'Encoding',
    Other = 'Other',
}

export enum Source {
    Assign = 'Assign',
    Search = 'Search',
    SearchNested = 'SearchNested',
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
    GetIndexedRanges = 'GetIndexedRanges',
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
    ComponentsOptions = 'ComponentsOptions',
    GetIdent = 'GetIdent',
    ComponentsValidate = 'ComponentsValidate',
    IdentList = 'IdentList',
    Native = 'Native',
    Other = 'Other',
}

export class NativeError extends Error {
    private readonly _type: Type;
    private readonly _source: Source;
    private readonly _logger: Logger = scope.getLogger(`NativeError`);

    public static from(smth: any): Error {
        if (smth instanceof Error) {
            return smth;
        }
        if (typeof smth === 'string') {
            return new Error(smth);
        }
        if (smth instanceof Buffer || smth instanceof Uint8Array) {
            try {
                const err = protocol.decodeComputationError(
                    smth instanceof Buffer ? Uint8Array.from(smth) : smth,
                );
                if (err === null) {
                    return new NativeError(
                        new Error(`Fail decode error`),
                        Type.InvalidData,
                        Source.Native,
                    );
                }
                if (typeof err === 'string') {
                    if ('DestinationPath' === err) {
                        return new NativeError(
                            new Error(`Destination path error`),
                            Type.Communication,
                            Source.Native,
                        );
                    } else if ('SessionCreatingFail' === err) {
                        return new NativeError(
                            new Error(`Fail to create a session`),
                            Type.SessionCreatingFail,
                            Source.Native,
                        );
                    } else if ('InvalidData' === err) {
                        return new NativeError(
                            new Error(`Invalid data`),
                            Type.InvalidData,
                            Source.Native,
                        );
                    } else if ('MultipleInitCall' === err) {
                        return new NativeError(
                            new Error(`Multiple init call`),
                            Type.MultipleInitCall,
                            Source.Native,
                        );
                    } else if ('SessionUnavailable' === err) {
                        return new NativeError(
                            new Error(`Session is unavailable`),
                            Type.SessionUnavailable,
                            Source.Native,
                        );
                    }
                } else if ('Communication' in err) {
                    return new NativeError(
                        new Error(err.Communication),
                        Type.Communication,
                        Source.Native,
                    );
                } else if ('OperationNotSupported' in err) {
                    return new NativeError(
                        new Error(err.OperationNotSupported),
                        Type.OperationNotSupported,
                        Source.Native,
                    );
                } else if ('IoOperation' in err) {
                    return new NativeError(
                        new Error(err.IoOperation),
                        Type.IoOperation,
                        Source.Native,
                    );
                } else if ('InvalidArgs' in err) {
                    return new NativeError(
                        new Error(err.InvalidArgs),
                        Type.InvalidArgs,
                        Source.Native,
                    );
                } else if ('Process' in err) {
                    return new NativeError(new Error(err.Process), Type.Process, Source.Native);
                } else if ('Protocol' in err) {
                    return new NativeError(new Error(err.Protocol), Type.Protocol, Source.Native);
                } else if ('SearchError' in err) {
                    return new NativeError(
                        new Error(`Search error: ${err.SearchError}`),
                        Type.SearchError,
                        Source.Native,
                    );
                } else if ('NativeError' in err) {
                    return new NativeError(
                        new Error(err.NativeError?.message),
                        Type.NativeError,
                        Source.Native,
                    );
                } else if ('Grabbing' in err) {
                    return new NativeError(
                        new Error(`Grabbing error: ${err.Grabbing}`),
                        Type.SearchError,
                        Source.Native,
                    );
                } else if ('Sde' in err) {
                    return new NativeError(new Error(err.Sde), Type.Sde, Source.Native);
                } else if ('Decoding' in err) {
                    return new NativeError(new Error(err.Decoding), Type.Decoding, Source.Native);
                } else if ('Encoding' in err) {
                    return new NativeError(new Error(err.Encoding), Type.Encoding, Source.Native);
                } else {
                    return new NativeError(
                        new Error(`Fail to recognize error: ${JSON.stringify(err)}`),
                        Type.Unrecognized,
                        Source.Native,
                    );
                }
            } catch (err) {
                return new NativeError(
                    new Error(`Fail to decode error: ${utils.error(err)}`),
                    Type.Other,
                    Source.Other,
                );
            }
        }
        return smth instanceof Error
            ? smth
            : new Error(`${typeof smth !== 'string' ? JSON.stringify(smth) : smth}`);
    }
    constructor(error: Error, kind: Type, source: Source) {
        super(error.message);
        this.stack = error.stack;
        this._type = kind;
        this._source = source;
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

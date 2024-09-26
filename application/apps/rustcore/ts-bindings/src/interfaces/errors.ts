import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { error as e } from 'platform/log/utils';

import * as proto from 'protocol';
import * as ty from '../protocol/index';

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

function getGrubErr(err: ty.GrabError | null | undefined): NativeError {
    if (err === null || err === undefined) {
        return new NativeError(new Error('Grabbing error'), Type.Grabbing, Source.Native);
    }
    const inner = err.grab_error_oneof;
    if (inner === null) {
        return new NativeError(new Error('Grabbing error'), Type.Grabbing, Source.Native);
    } else {
        if ('Config' in inner) {
            return new NativeError(
                new Error(`Grabbing [Config]: ${inner.GrabConfig?.message}`),
                Type.Grabbing,
                Source.Native,
            );
        } else if ('Communication' in inner) {
            return new NativeError(
                new Error(`Grabbing [Communication]: ${inner.GrabCommunication?.message}`),
                Type.Grabbing,
                Source.Native,
            );
        } else if ('IoOperation' in inner) {
            return new NativeError(
                new Error(`Grabbing [IoOperation]: ${inner.GrabIoOperation?.message}`),
                Type.Grabbing,
                Source.Native,
            );
        } else if ('InvalidRange' in inner) {
            return new NativeError(
                new Error(
                    `Grabbing [InvalidRange]: ${
                        inner.InvalidRange?.context
                    }; range: ${JSON.stringify(inner.InvalidRange?.range)}`,
                ),
                Type.Grabbing,
                Source.Native,
            );
        } else if ('Interrupted' in inner) {
            return new NativeError(
                new Error(`Grabbing [Interrupted]`),
                Type.Grabbing,
                Source.Native,
            );
        } else if ('Unsupported' in inner) {
            return new NativeError(
                new Error(`Grabbing [Unsupported]: ${inner.Unsupported?.message}`),
                Type.Grabbing,
                Source.Native,
            );
        } else if ('NotInitialize' in inner) {
            return new NativeError(
                new Error(`Grabbing [NotInitialize]}`),
                Type.Grabbing,
                Source.Native,
            );
        } else {
            return new NativeError(
                new Error('Unknown grabbing error'),
                Type.Grabbing,
                Source.Native,
            );
        }
    }
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
                const deserialized: ty.ComputationError = proto.ComputationError.decode(
                    Uint8Array.from(smth),
                );
                const err = deserialized.comp_error_oneof;
                if (err === null) {
                    return new NativeError(
                        new Error(`Fail decode error`),
                        Type.InvalidData,
                        Source.Native,
                    );
                }
                if ('DestinationPath' in err) {
                    return new NativeError(
                        new Error(`Destination path error`),
                        Type.Communication,
                        Source.Native,
                    );
                } else if ('SessionCreatingFail' in err) {
                    return new NativeError(
                        new Error(`Fail to create a session`),
                        Type.SessionCreatingFail,
                        Source.Native,
                    );
                } else if ('Communication' in err) {
                    return new NativeError(
                        new Error(err.CompCommunication?.message),
                        Type.Communication,
                        Source.Native,
                    );
                } else if ('OperationNotSupported' in err) {
                    return new NativeError(
                        new Error(err.OperationNotSupported?.message),
                        Type.OperationNotSupported,
                        Source.Native,
                    );
                } else if ('InvalidData' in err) {
                    return new NativeError(
                        new Error(`Invalid data`),
                        Type.InvalidData,
                        Source.Native,
                    );
                } else if ('IoOperation' in err) {
                    return new NativeError(
                        new Error(err.CompIoOperation?.message),
                        Type.IoOperation,
                        Source.Native,
                    );
                } else if ('InvalidArgs' in err) {
                    return new NativeError(
                        new Error(err.InvalidArgs?.message),
                        Type.InvalidArgs,
                        Source.Native,
                    );
                } else if ('Process' in err) {
                    return new NativeError(
                        new Error(err.Process?.message),
                        Type.Process,
                        Source.Native,
                    );
                } else if ('Protocol' in err) {
                    return new NativeError(
                        new Error(err.Protocol?.message),
                        Type.Protocol,
                        Source.Native,
                    );
                } else if ('SearchError' in err) {
                    const inner =
                        err.SearchError?.search_error_oneof === null ||
                        err.SearchError?.search_error_oneof === undefined
                            ? null
                            : err.SearchError?.search_error_oneof;
                    if (inner === null) {
                        return new NativeError(
                            new Error(`Unknown SearchError`),
                            Type.SearchError,
                            Source.Native,
                        );
                    } else {
                        if ('Config' in inner) {
                            return new NativeError(
                                new Error(`Search error [Config]: ${inner.SearchConfig?.message}`),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else if ('Communication' in inner) {
                            return new NativeError(
                                new Error(
                                    `Search error [Communication]: ${inner.SearchCommunication?.message}`,
                                ),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else if ('IoOperation' in inner) {
                            return new NativeError(
                                new Error(
                                    `Search error [IoOperation]: ${inner.SearchIoOperation?.message}`,
                                ),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else if ('Regex' in inner) {
                            return new NativeError(
                                new Error(`Search error [Regex]: ${inner.Regex?.message}`),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else if ('Input' in inner) {
                            return new NativeError(
                                new Error(`Search error [Input]: ${inner.Input?.message}`),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else if ('Grab' in inner) {
                            return new NativeError(
                                new Error(`Search error [Grab]: ${getGrubErr(inner.Grab?.error)}`),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else if ('Aborted' in inner) {
                            return new NativeError(
                                new Error(`Search error [Aborted]: ${inner.Aborted?.message}`),
                                Type.SearchError,
                                Source.Native,
                            );
                        } else {
                            return new NativeError(
                                new Error(`Unknown SearchError`),
                                Type.SearchError,
                                Source.Native,
                            );
                        }
                    }
                } else if ('MultipleInitCall' in err) {
                    return new NativeError(
                        new Error(`Multiple init call`),
                        Type.MultipleInitCall,
                        Source.Native,
                    );
                } else if ('SessionUnavailable' in err) {
                    return new NativeError(
                        new Error(`Session is unavailable`),
                        Type.SessionUnavailable,
                        Source.Native,
                    );
                } else if ('NativeError' in err) {
                    return new NativeError(
                        new Error(err.NativeError?.message),
                        Type.NativeError,
                        Source.Native,
                    );
                } else if ('Grabbing' in err) {
                    return getGrubErr(
                        err.Grabbing?.error === null || err.Grabbing?.error === undefined
                            ? null
                            : err.Grabbing?.error,
                    );
                } else if ('Sde' in err) {
                    return new NativeError(new Error(err.Sde?.message), Type.Sde, Source.Native);
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

import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';

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
    Concat = 'Concat',
    Merge = 'Merge',
    Extract = 'Extract',
    Export = 'Export',
    Detect = 'Detect',
    Abort = 'Abort',
    Sleep = 'Sleep',
    AddBookmark = 'AddBookmark',
    SetBookmarks = 'SetBookmarks',
    RemoveSelection = 'RemoveSelection',
    AddSelection = 'AddSelection',
    RemoveBookmark = 'RemoveBookmark',
    ExpandBreadcrumbs = 'ExpandBreadcrumbs',
    SetIndexingMode = 'SetIndexingMode',
    GetIndexedLen = 'GetIndexedLen',
    getAroundIndexes = 'getAroundIndexes',
    Other = 'Other',
}

export class NativeError extends Error {
    private readonly _type: Type;
    private readonly _source: Source;
    private readonly _logger: Logger = scope.getLogger(`NativeError`);

    public static from(smth: any): Error {
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

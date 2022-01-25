import * as Logs from '../util/logging';

export enum Type {
    NotImplemented = 'NotImplemented',
    InvalidInput = 'InvalidInput',
    InvalidOutput = 'InvalidOutput',
    GrabbingSearch = 'GrabbingSearch',
    GrabbingContent = 'GrabbingContent',
    ParsingContentChunk = 'ParsingContentChunk',
    ParsingSearchChunk = 'ParsingSearchChunk',
    CancelationError = 'CancelationError',
    Other = 'Other',
}

export enum Source {
    Assign = 'Assign',
    Search = 'Search',
    GetMap = 'GetMap',
    ExtractMatchesValues = 'ExtractMatchesValues',
    GrabStreamChunk = 'GrabStreamChunk',
    GrabSearchChunk = 'GrabSearchChunk',
    GetSocketPath = 'GetSocketPath',
    GetNearestTo = 'GetNearestTo',
    GetStreamLen = 'GetStreamLen',
    GetSearchLen = 'GetSearchLen',
    GetFilters = 'GetFilters',
    GetOperationsStat = 'GetOperationsStat',
    SetDebug = 'SetDebug',
    Concat = 'Concat',
    Merge = 'Merge',
    Extract = 'Extract',
    Export = 'Export',
    Detect = 'Detect',
    Abort = 'Abort',
    Sleep = 'Sleep',
    Other = 'Other',
}

export class NativeError extends Error {
    private readonly _type: Type;
    private readonly _source: Source;
    private readonly _logger: Logs.Logger = Logs.getLogger(`NativeError`);

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

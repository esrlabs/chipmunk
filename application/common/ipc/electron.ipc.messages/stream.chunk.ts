export interface IStreamChunk {
    guid: string;
    data?: string;
    start: number;
    end: number;
    length?: number;
    rows?: number;
    error?: string;
}

export interface IValidStreamChunk {
    guid: string;
    data: string;
    start: number;
    end: number;
    length: number;
    rows: number;
}

export class StreamChunk {
    public static signature: string = 'StreamChunk';
    public signature: string = StreamChunk.signature;
    public guid: string;
    public data?: string;
    public start: number;
    public end: number;
    public length?: number;
    public rows?: number;
    public error?: string;

    constructor(params: IStreamChunk) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamChunk message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.data !== 'string' && params.data !== undefined) {
            throw new Error(`Field "data" should be defined as string or should be "undefined"`);
        }
        if (typeof params.error !== 'string' && params.error !== undefined) {
            throw new Error(`Field "data" should be defined as string or should be "undefined"`);
        }
        if (typeof params.start !== 'number' || isNaN(params.start) || !isFinite(params.start)) {
            throw new Error(`Field "start" should be defined as number (not NaN and finited)`);
        }
        if (typeof params.end !== 'number' || isNaN(params.end) || !isFinite(params.end)) {
            throw new Error(`Field "end" should be defined as number (not NaN and finited)`);
        }
        if (
            params.length !== undefined &&
            (typeof params.length !== 'number' || isNaN(params.length) || !isFinite(params.length))
        ) {
            throw new Error(`Field "length" should be defined as number (not NaN and finited)`);
        }
        if (
            params.rows !== undefined &&
            (typeof params.rows !== 'number' || isNaN(params.rows) || !isFinite(params.rows))
        ) {
            throw new Error(`Field "rows" should be defined as number (not NaN and finited)`);
        }
        this.guid = params.guid;
        this.data = params.data;
        this.start = params.start;
        this.end = params.end;
        this.length = params.length;
        this.rows = params.rows;
        this.error = params.error;
    }
}

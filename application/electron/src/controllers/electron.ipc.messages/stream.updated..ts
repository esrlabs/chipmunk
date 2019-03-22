export interface IStreamUpdated {
    guid: string;
    length: number;
    rows: number;
}

export class StreamUpdated {
    public static signature: string = 'StreamUpdated';
    public signature: string = StreamUpdated.signature;
    public guid: string;
    public length: number;
    public rows: number;

    constructor(params: IStreamUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamUpdated message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.length !== 'number' || isNaN(params.length) || !isFinite(params.length)) {
            throw new Error(`Field "length" should be defined as number (not NaN and finited)`);
        }
        if (typeof params.rows !== 'number' || isNaN(params.rows) || !isFinite(params.rows)) {
            throw new Error(`Field "rows" should be defined as number (not NaN and finited)`);
        }
        this.guid = params.guid;
        this.length = params.length;
        this.rows = params.rows;
    }
}

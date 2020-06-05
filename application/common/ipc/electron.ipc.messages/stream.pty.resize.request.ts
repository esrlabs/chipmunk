export interface IStreamPtyResizeRequest {
    guid: string;
    col: number;
    row: number;
}

export class StreamPtyResizeRequest {
    public static signature: string = 'StreamPtyResizeRequest';
    public signature: string = StreamPtyResizeRequest.signature;
    public guid: string;
    public col: number;
    public row: number;

    constructor(params: IStreamPtyResizeRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyResizeRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.row !== 'number' || isNaN(params.row) || !isFinite(params.col)) {
            throw new Error(`Field "row" should be defined`);
        }
        if (typeof params.col !== 'number' || isNaN(params.col) || !isFinite(params.col)) {
            throw new Error(`Field "col" should be defined`);
        }
        this.guid = params.guid;
        this.row = params.row;
        this.col = params.col;
    }
}

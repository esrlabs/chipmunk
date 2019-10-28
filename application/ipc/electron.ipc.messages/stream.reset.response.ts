export interface IStreamResetResponse {
    guid: string;
    error?: string;
}

export class StreamResetResponse {
    public static signature: string = 'StreamResetResponse';
    public signature: string = StreamResetResponse.signature;
    public guid: string;
    public error?: string;

    constructor(params: IStreamResetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamResetResponse message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
        this.error = params.error;
    }
}

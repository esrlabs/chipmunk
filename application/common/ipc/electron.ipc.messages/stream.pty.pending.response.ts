export interface IStreamPtyPendingResponse {
    error?: string;
    pending: string;
}

export class StreamPtyPendingResponse {
    public static signature: string = 'StreamPtyPendingResponse';
    public signature: string = StreamPtyPendingResponse.signature;
    public error?: string;
    public pending: string;

    constructor(params: IStreamPtyPendingResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyPendingResponse message`);
        }
        if (typeof params.pending !== 'string') {
            throw new Error(`Field "pending" should be defined`);
        }
        this.error = params.error;
        this.pending = params.pending;
    }
}

export interface IStreamPtyStreamingResponse {
    error?: string;
}

export class StreamPtyStreamingResponse {
    public static signature: string = 'StreamPtyStreamingResponse';
    public signature: string = StreamPtyStreamingResponse.signature;
    public error?: string;

    constructor(params: IStreamPtyStreamingResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyStreamingResponse message`);
        }
        this.error = params.error;
    }
}

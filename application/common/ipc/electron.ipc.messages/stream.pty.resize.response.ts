export interface IStreamPtyResizeResponse {
    error?: string;
}

export class StreamPtyResizeResponse {
    public static signature: string = 'StreamPtyResizeResponse';
    public signature: string = StreamPtyResizeResponse.signature;
    public error?: string;

    constructor(params: IStreamPtyResizeResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyResizeResponse message`);
        }
        this.error = params.error;
    }
}

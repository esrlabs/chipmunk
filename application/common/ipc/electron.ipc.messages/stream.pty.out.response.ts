export interface IStreamPtyOutResponse {
    error?: string;
}

export class StreamPtyOutResponse {
    public static signature: string = 'StreamPtyOutResponse';
    public signature: string = StreamPtyOutResponse.signature;
    public error?: string;

    constructor(params: IStreamPtyOutResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyOutResponse message`);
        }
        this.error = params.error;
    }
}

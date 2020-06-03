export interface IStreamPtyInResponse {
    error?: string;
}

export class StreamPtyInResponse {
    public static signature: string = 'StreamPtyInResponse';
    public signature: string = StreamPtyInResponse.signature;
    public error?: string;

    constructor(params: IStreamPtyInResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyInResponse message`);
        }
        this.error = params.error;
    }
}

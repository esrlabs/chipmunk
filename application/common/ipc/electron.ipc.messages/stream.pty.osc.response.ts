export interface IStreamPtyOscResponse {
    error?: string;
}

export class StreamPtyOscResponse {
    public static signature: string = 'StreamPtyOscResponse';
    public signature: string = StreamPtyOscResponse.signature;
    public error?: string;

    constructor(params: IStreamPtyOscResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyOscResponse message`);
        }
        this.error = params.error;
    }
}

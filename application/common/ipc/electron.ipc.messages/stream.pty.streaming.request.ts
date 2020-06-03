export interface IStreamPtyStreamingRequest {
    guid: string;
    streaming: boolean;
}

export class StreamPtyStreamingRequest {
    public static signature: string = 'StreamPtyStreamingRequest';
    public signature: string = StreamPtyStreamingRequest.signature;
    public guid: string;
    public streaming: boolean;

    constructor(params: IStreamPtyStreamingRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyStreamingRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.streaming !== 'boolean') {
            throw new Error(`Field "streaming" should be defined`);
        }
        this.guid = params.guid;
        this.streaming = params.streaming;
    }
}

export interface IStreamPtyOscRequest {
    guid: string;
    streaming: boolean;
    title: string;
}

export class StreamPtyOscRequest {
    public static signature: string = 'StreamPtyOscRequest';
    public signature: string = StreamPtyOscRequest.signature;
    public guid: string;
    public streaming: boolean;
    public title: string;

    constructor(params: IStreamPtyOscRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyOscRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.streaming !== 'boolean') {
            throw new Error(`Field "streaming" should be defined`);
        }
        if (typeof params.title !== 'string' || params.title.trim() === '') {
            throw new Error(`Field "title" should be defined`);
        }
        this.guid = params.guid;
        this.title = params.title;
        this.streaming = params.streaming;
    }
}

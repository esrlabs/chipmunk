export interface IStreamPtyInRequest {
    guid: string;
    data: string;
}

export class StreamPtyInRequest {
    public static signature: string = 'StreamPtyInRequest';
    public signature: string = StreamPtyInRequest.signature;
    public guid: string;
    public data: string;

    constructor(params: IStreamPtyInRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyInRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.data !== 'string') {
            throw new Error(`Field "data" should be defined`);
        }
        this.guid = params.guid;
        this.data = params.data;
    }
}

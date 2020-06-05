export interface IStreamPtyOutRequest {
    guid: string;
    data: string;
}

export class StreamPtyOutRequest {
    public static signature: string = 'StreamPtyOutRequest';
    public signature: string = StreamPtyOutRequest.signature;
    public guid: string;
    public data: string;

    constructor(params: IStreamPtyOutRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyOutRequest message`);
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

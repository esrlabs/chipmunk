export interface IStreamPtyPendingRequest {
    guid: string;
}

export class StreamPtyPendingRequest {
    public static signature: string = 'StreamPtyPendingRequest';
    public signature: string = StreamPtyPendingRequest.signature;
    public guid: string;

    constructor(params: IStreamPtyPendingRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPtyPendingRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

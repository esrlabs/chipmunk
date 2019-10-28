export interface IStreamRemoveRequest {
    guid: string;
}

export class StreamRemoveRequest {
    public static signature: string = 'StreamRemoveRequest';
    public signature: string = StreamRemoveRequest.signature;
    public guid: string;

    constructor(params: IStreamRemoveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamRemoveRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

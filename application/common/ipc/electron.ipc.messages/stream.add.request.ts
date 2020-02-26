export interface IStreamAddRequest {
    guid: string;
}

export class StreamAddRequest {
    public static signature: string = 'StreamAddRequest';
    public signature: string = StreamAddRequest.signature;
    public guid: string;

    constructor(params: IStreamAddRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamAddRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

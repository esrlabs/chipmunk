export interface IStreamResetRequest {
    guid: string;
}

export class StreamResetRequest {
    public static signature: string = 'StreamResetRequest';
    public signature: string = StreamResetRequest.signature;
    public guid: string;

    constructor(params: IStreamResetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamResetRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

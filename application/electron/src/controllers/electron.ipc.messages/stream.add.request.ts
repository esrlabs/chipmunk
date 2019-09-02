export interface IStreamAddRequest {
    guid: string;
    transports: string[];
}

export class StreamAddRequest {
    public static signature: string = 'StreamAddRequest';
    public signature: string = StreamAddRequest.signature;
    public guid: string;
    public transports: string[];

    constructor(params: IStreamAddRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamAddRequest message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (!(params.transports instanceof Array)) {
            throw new Error(`Field "transports" should be Array<string>`);
        }
        this.guid = params.guid;
        this.transports = params.transports;
    }
}

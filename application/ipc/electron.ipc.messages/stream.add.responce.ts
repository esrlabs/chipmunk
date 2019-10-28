export interface IStreamAddResponse {
    guid: string;
    error?: string;
}

export class StreamAddResponse {
    public static signature: string = 'StreamAddResponse';
    public signature: string = StreamAddResponse.signature;
    public guid: string;
    public error?: string;

    constructor(params: IStreamAddResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamAddResponse message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
        this.error = params.error;
    }
}

export interface IStreamRemoveResponse {
    guid: string;
    error?: string;
}

export class StreamRemoveResponse {
    public static signature: string = 'StreamRemoveResponse';
    public signature: string = StreamRemoveResponse.signature;
    public guid: string;
    public error?: string;

    constructor(params: IStreamRemoveResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamRemoveResponse message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
        this.error = params.error;
    }
}

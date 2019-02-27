export interface IStreamData {
    guid: string;
    data: string;
}

export class StreamData {
    public static signature: string = 'StreamData';
    public signature: string = StreamData.signature;
    public guid: string;
    public data: string;

    constructor(params: IStreamData) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamData message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.data !== 'string') {
            throw new Error(`Field "data" should be defined as string`);
        }
        this.guid = params.guid;
        this.data = params.data;
    }
}

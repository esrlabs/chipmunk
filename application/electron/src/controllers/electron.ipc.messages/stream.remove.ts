export interface IStreamRemove {
    guid: string;
}

export class StreamRemove {
    public static signature: string = 'StreamRemove';
    public signature: string = StreamRemove.signature;
    public guid: string;

    constructor(params: IStreamRemove) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamRemove message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

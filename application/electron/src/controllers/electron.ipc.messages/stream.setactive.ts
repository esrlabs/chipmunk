export interface IStreamSetActive {
    guid: string;
}

export class StreamSetActive {
    public static signature: string = 'StreamSetActive';
    public signature: string = StreamSetActive.signature;
    public guid: string;

    constructor(params: IStreamSetActive) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamSetActive message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

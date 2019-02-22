export interface IStreamAdd {
    guid: string;
}

export class StreamAdd {
    public static signature: string = 'StreamAdd';
    public signature: string = StreamAdd.signature;
    public guid: string;

    constructor(params: IStreamAdd) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamAdd message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}

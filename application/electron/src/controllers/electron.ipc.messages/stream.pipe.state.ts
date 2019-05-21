export interface IStreamPipeState {
    streamId: string;
    size: number;
    done: number;
    items: string[];
}

export class StreamPipeState {
    public static signature: string = 'StreamPipeState';
    public signature: string = StreamPipeState.signature;
    public streamId: string;
    public size: number;
    public done: number;
    public items: string[];

    constructor(params: IStreamPipeState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPipeState message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.size !== 'number' || isNaN(params.size) || !isFinite(params.size)) {
            throw new Error(`Field "size" should be defined as number`);
        }
        if (typeof params.done !== 'number' || isNaN(params.done) || !isFinite(params.done)) {
            throw new Error(`Field "done" should be defined as number`);
        }
        if (!(params.items instanceof Array)) {
            throw new Error(`Field "params.items" should be defined as string[]`);
        }
        this.streamId = params.streamId;
        this.size = params.size;
        this.done = params.done;
        this.items = params.items;
    }
}

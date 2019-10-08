export interface IStreamProgressState {
    streamId: string;
    progress: number;
    items: string[];
}

export class StreamProgressState {
    public static signature: string = 'StreamProgressState';
    public signature: string = StreamProgressState.signature;
    public streamId: string;
    public progress: number;
    public items: string[];

    constructor(params: IStreamProgressState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamProgressState message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.progress !== 'number' || isNaN(params.progress) || !isFinite(params.progress)) {
            throw new Error(`Field "progress" should be defined as number`);
        }
        if (params.progress < 0 || params.progress > 1) {
            throw new Error(`Field "progress" should be > 0 and < 1`);
        }
        if (!(params.items instanceof Array)) {
            throw new Error(`Field "params.items" should be defined as string[]`);
        }
        this.streamId = params.streamId;
        this.progress = params.progress;
        this.items = params.items;
    }
}

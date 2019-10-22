export interface IStreamPipeProgress {
    name: string;
    done: number;
    size: number;
    started: number;
}

export interface IStreamPipeState {
    streamId: string;
    tracks: IStreamPipeProgress[];
}

export class StreamPipeState {
    public static signature: string = 'StreamPipeState';
    public signature: string = StreamPipeState.signature;
    public streamId: string;
    public tracks: IStreamPipeProgress[];

    constructor(params: IStreamPipeState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamPipeState message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (!(params.tracks instanceof Array)) {
            throw new Error(`Field "params.tracks" should be defined as string[]`);
        }
        this.streamId = params.streamId;
        this.tracks = params.tracks;
    }
}

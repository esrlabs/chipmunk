export interface IStreamProgressTrack {
    name: string;
    progress: number;
    started: number;
}

export interface IStreamProgressState {
    streamId: string;
    tracks: IStreamProgressTrack[];
}

export class StreamProgressState {
    public static signature: string = 'StreamProgressState';
    public signature: string = StreamProgressState.signature;
    public streamId: string;
    public tracks: IStreamProgressTrack[];

    constructor(params: IStreamProgressState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamProgressState message`);
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

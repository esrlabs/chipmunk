export interface ISessionStreamPipeStarted {
    pipeId: string;
    streamId: string;
    size: number;
    name: string;
}

export class SessionStreamPipeStarted {
    public static signature: string = 'SessionStreamPipeStarted';
    public signature: string = SessionStreamPipeStarted.signature;

    public pipeId: string;
    public streamId: string;
    public size: number;
    public name: string;

    constructor(params: ISessionStreamPipeStarted) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.pipeId !== 'string' || params.pipeId.trim() === '') {
            throw new Error(`Field "pipeId" should be defined as string`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined as string`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be defined as string`);
        }
        if (typeof params.size !== 'number' || isNaN(params.size) || !isFinite(params.size)) {
            throw new Error(`Field "size" should be defined as number`);
        }
        this.pipeId = params.pipeId;
        this.streamId = params.streamId;
        this.name = params.name;
        this.size = params.size;
    }
}

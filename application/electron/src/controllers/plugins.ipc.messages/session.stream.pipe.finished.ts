export interface ISessionStreamPipeFinished {
    pipeId: string;
    streamId: string;
}

export class SessionStreamPipeFinished {
    public static signature: string = 'SessionStreamPipeFinished';
    public signature: string = SessionStreamPipeFinished.signature;

    public pipeId: string;
    public streamId: string;

    constructor(params: ISessionStreamPipeFinished) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.pipeId !== 'string' || params.pipeId.trim() === '') {
            throw new Error(`Field "pipeId" should be defined as string`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined as string`);
        }
        this.pipeId = params.pipeId;
        this.streamId = params.streamId;
    }
}

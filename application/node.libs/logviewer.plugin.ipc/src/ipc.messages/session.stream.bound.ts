export interface ISessionStreamBound {
    streamId: string;
    error?: string;
}

export class SessionStreamBound {
    public static signature: string = 'SessionStreamBound';
    public signature: string = SessionStreamBound.signature;

    public streamId: string;
    public error?: string;

    constructor(params: ISessionStreamBound) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined as string`);
        }
        this.error = params.error;
        this.streamId = params.streamId;
    }
}

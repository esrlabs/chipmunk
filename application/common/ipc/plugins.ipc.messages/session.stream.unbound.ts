export interface ISessionStreamUnbound {
    streamId: string;
    error?: string;
}

export class SessionStreamUnbound {
    public static signature: string = 'SessionStreamUnbound';
    public signature: string = SessionStreamUnbound.signature;

    public streamId: string;
    public error?: string;

    constructor(params: ISessionStreamUnbound) {
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

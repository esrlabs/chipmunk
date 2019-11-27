export enum ESessionStreamState {
    block = 'block',
    unblock = 'unblock',
}

export interface ISessionStreamState {
    state?: ESessionStreamState;
    stream: string;
}

export class SessionStreamState {
    public static States = ESessionStreamState;
    public static signature: string = 'SessionStreamState';
    public signature: string = SessionStreamState.signature;

    public stream: string = '';
    public state: ESessionStreamState = ESessionStreamState.unblock;

    constructor(params: ISessionStreamState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.stream !== 'string' || params.stream.trim() === '') {
            throw new Error(`Field "stream" should be defined`);
        }
        this.stream = params.stream;
        this.state = typeof params.state === 'string' ? params.state : ESessionStreamState.unblock;
    }
}

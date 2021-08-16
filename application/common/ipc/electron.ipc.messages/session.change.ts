export interface ISessionChange {
    isSession: boolean;
}

export class SessionChange {

    public static signature: string = 'SessionChange';
    public signature: string = SessionChange.signature;
    public isSession: boolean;

    constructor(params: ISessionChange) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SessionChange message`);
        }
        if (typeof params.isSession !== 'boolean') {
            throw new Error(`Expected isSession to be boolean`);
        }
        this.isSession = params.isSession
    }
}

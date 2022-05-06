export interface IShellProcessHistoryGetRequest {
    session: string;
}

export class ShellProcessHistoryGetRequest {
    public static signature: string = 'ShellProcessHistoryGetRequest';
    public signature: string = ShellProcessHistoryGetRequest.signature;
    public session: string;

    constructor(params: IShellProcessHistoryGetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessHistoryGetRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}

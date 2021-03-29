export interface IShellLoadRequest {
    session: string;
}

export class ShellLoadRequest {

    public static signature: string = 'ShellLoadRequest';
    public signature: string = ShellLoadRequest.signature;
    public session: string;

    constructor(params: IShellLoadRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellLoadRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }

}

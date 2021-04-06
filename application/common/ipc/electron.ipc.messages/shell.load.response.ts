export interface IShellLoadResponse {
    session: string;
    presetTitle: string;
}

export class ShellLoadResponse {

    public static signature: string = 'ShellLoadResponse';
    public signature: string = ShellLoadResponse.signature;
    public session: string;
    public presetTitle: string;

    constructor(params: IShellLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellLoadResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.presetTitle !== 'string') {
            throw new Error(`Expecting presetTitle to be a string`);
        }
        this.session = params.session;
        this.presetTitle = params.presetTitle;
    }

}

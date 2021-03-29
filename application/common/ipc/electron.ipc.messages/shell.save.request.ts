export interface IShellSaveRequest {
    session: string;
    presetTitle: string;
}

export class ShellSaveRequest {

    public static signature: string = 'ShellSaveRequest';
    public signature: string = ShellSaveRequest.signature;
    public session: string;
    public presetTitle: string;

    constructor(params: IShellSaveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellSaveRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.presetTitle !== 'string' || params.presetTitle.trim() === '') {
            throw new Error(`Expecting presetTitle to be a string`);
        }
        this.session = params.session;
        this.presetTitle = params.presetTitle;
    }

}

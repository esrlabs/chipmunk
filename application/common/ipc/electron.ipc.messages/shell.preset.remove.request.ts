export interface IShellPresetRemoveRequest {
    session: string;
    title: string;
}

export class ShellPresetRemoveRequest {

    public static signature: string = 'ShellPresetRemoveRequest';
    public signature: string = ShellPresetRemoveRequest.signature;
    public session: string;
    public title: string;

    constructor(params: IShellPresetRemoveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellPresetRemoveRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.title !== 'string' || params.title.trim() === '') {
            throw new Error(`Expecting title to be a string`);
        }
        this.session = params.session;
        this.title = params.title;
    }
}

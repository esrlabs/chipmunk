import { IBundle } from './shell.process.history.get.response';

export interface IShellProcessBundleRemoveRequest {
    session: string;
    bundles: IBundle[];
}

export class ShellProcessBundleRemoveRequest {
    public static signature: string = 'ShellProcessBundleRemoveRequest';
    public signature: string = ShellProcessBundleRemoveRequest.signature;
    public session: string;
    public bundles: IBundle[];

    constructor(params: IShellProcessBundleRemoveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessBundleRemoveRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (!(params.bundles instanceof Array)) {
            throw new Error(`Expecting processes to be an Array<IBundle>`);
        }
        this.session = params.session;
        this.bundles = params.bundles;
    }
}

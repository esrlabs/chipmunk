import { IBundle } from './shell.process.history.get.response';

export interface IShellProcessBundleSetRequest {
    session: string;
    bundle: IBundle;
}

export class ShellProcessBundleSetRequest {
    public static signature: string = 'ShellProcessBundleSetRequest';
    public signature: string = ShellProcessBundleSetRequest.signature;
    public session: string;
    public bundle: IBundle;

    constructor(params: IShellProcessBundleSetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessBundleSetRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.bundle !== 'object' || params.bundle === null) {
            throw new Error(`Expecting bundle to be an IBundle`);
        }
        this.session = params.session;
        this.bundle = params.bundle;
    }
}

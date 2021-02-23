import { IShellProcess } from './shell.process.list.response';

export interface IShellProcessDetailsResponse {
    error?: string;
    info?: IShellProcess;
}

export class ShellProcessDetailsResponse {

    public static signature: string = 'ShellProcessDetailsResponse';
    public signature: string = ShellProcessDetailsResponse.signature;
    public error?: string;
    public info?: IShellProcess;

    constructor(params: IShellProcessDetailsResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessDetailsResponse message`);
        }
        if (params.info !== undefined && typeof params.info !== 'object') {
            throw new Error(`Expecting info to be a object`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
        this.info = params.info;
    }
}

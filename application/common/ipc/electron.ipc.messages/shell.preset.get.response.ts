import { IPreset } from './shell.preset.set.request';

export interface IShellPresetGetResponse {
    session: string;
    presets: IPreset[];
}

export class ShellPresetGetResponse {

    public static signature: string = 'ShellPresetGetResponse';
    public signature: string = ShellPresetGetResponse.signature;
    public session: string;
    public presets: IPreset[];

    constructor(params: IShellPresetGetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellPresetGetResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (!(params.presets instanceof Array)) {
            throw new Error(`Expecting processes to be an Array<IPreset>`);
        }
        this.session = params.session;
        this.presets = params.presets;
    }
}

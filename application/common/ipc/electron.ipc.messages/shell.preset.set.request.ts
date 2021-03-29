export interface IEditing {
    variable: boolean;
    value: boolean;
}

export interface IEnvironment {
    variable: string;
    value: string;
    custom: boolean;
    editing: IEditing;
    selected: boolean;
}

export interface IInformation {
    shell?: string;
    pwd?: string;
    env?: IEnvironment[];
}

export interface IPreset {
    information: IInformation;
    title: string;
    custom: boolean;
}

export interface IShellPresetSetRequest {
    session: string;
    preset: IPreset;
}

export class ShellPresetSetRequest {

    public static signature: string = 'ShellPresetSetRequest';
    public signature: string = ShellPresetSetRequest.signature;
    public session: string;
    public preset: IPreset;

    constructor(params: IShellPresetSetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellPresetSetRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.preset !== 'object' || params.preset === null) {
            throw new Error(`Expecting preset to be an object`);
        }
        this.session = params.session;
        this.preset = params.preset;
    }
}

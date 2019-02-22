export interface IPluginToken {
    token: string;
}

export class PluginToken {
    public static signature: string = 'PluginToken';
    public signature: string = PluginToken.signature;
    public token: string;

    constructor(params: IPluginToken) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginToken message`);
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            throw new Error(`Field "token" should be defined`);
        }
        this.token = params.token;
    }
}

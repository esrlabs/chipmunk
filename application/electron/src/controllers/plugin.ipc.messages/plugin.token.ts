export interface IPluginToken {
    token: string;
    id: number;
}

export class PluginToken {
    public static signature: string = 'PluginToken';
    public signature: string = PluginToken.signature;
    public token: string;
    public id: number;

    constructor(params: IPluginToken) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginToken message`);
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            throw new Error(`Field "token" should be defined`);
        }
        if (typeof params.id !== 'number') {
            throw new Error(`Field "id" should be defined as number`);
        }
        this.id = params.id;
        this.token = params.token;
    }
}

export interface IPluginMessage {
    message: any;
    token: string;
}

export class PluginMessage {
    public static signature: string = 'PluginMessage';
    public signature: string = PluginMessage.signature;
    public message: any;
    public token: string;

    constructor(params: IPluginMessage) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginMessage message`);
        }
        if (params.message === void 0) {
            throw new Error(`Field "message" should be defined`);
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            throw new Error(`Field "token" should be defined`);
        }
        this.message = params.message;
        this.token = params.token;
    }
}

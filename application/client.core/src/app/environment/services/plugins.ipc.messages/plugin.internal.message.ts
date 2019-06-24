
export interface IPluginInternalMessage {
    data: any;
    token: string;
    stream: string;
}

export class PluginInternalMessage {
    public static signature: string = 'PluginInternalMessage';
    public signature: string = PluginInternalMessage.signature;

    public data: any;
    public token: string;
    public stream: string;

    constructor(params: IPluginInternalMessage) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginInternalMessage message`);
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            throw new Error(`Field "token" should be defined`);
        }
        this.token = params.token;
        this.data = params.data;
        this.stream = params.stream;
    }
}

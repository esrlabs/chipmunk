export interface IPluginMessage {
    message: any;
}

export class PluginMessage {
    public static signature: string = 'PluginMessage';
    public signature: string = PluginMessage.signature;
    public message: any;

    constructor(params: IPluginMessage) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        if (params.message === void 0) {
            throw new Error(`Field "message" should be defined`);
        }
        this.message = params.message;
    }
}

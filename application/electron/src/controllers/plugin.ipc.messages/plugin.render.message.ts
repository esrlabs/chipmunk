
export interface IPluginRenderMessage {
    data: any;
}

export class PluginRenderMessage {
    public static signature: string = 'PluginRenderMessage';
    public signature: string = PluginRenderMessage.signature;

    public data: any;

    constructor(params: IPluginRenderMessage) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        this.data = params.data;
    }
}

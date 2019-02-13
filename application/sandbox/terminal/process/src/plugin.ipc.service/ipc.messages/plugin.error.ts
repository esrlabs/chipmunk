
export interface IPluginError {
    message?: string;
    data: any;
}

export class PluginError {
    public static signature: string = 'PluginError';
    public signature: string = PluginError.signature;

    public message: string = '';
    public data: any;

    constructor(params: IPluginError) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.message !== 'string') {
            throw new Error(`At least "message" field should be defined for this message`);
        }
        this.message = typeof params.message === 'string' ? params.message : '';
        this.data = params.data;
    }
}

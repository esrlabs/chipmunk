
export interface IPluginError {
    message: string;
    data: any;
    token: string;
    stream: string;
}

export class PluginError {
    public static signature: string = 'PluginError';
    public signature: string = PluginError.signature;

    public message: string = '';
    public data: any;
    public token: string;
    public stream: string;

    constructor(params: IPluginError) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.message !== 'string') {
            throw new Error(`At least "message" field should be defined for this message`);
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            throw new Error(`Field "token" should be defined`);
        }
        this.message = params.message;
        this.data = params.data;
        this.stream = params.stream;
        this.token = params.token;
    }
}

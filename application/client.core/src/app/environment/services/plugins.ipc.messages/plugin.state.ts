export enum EPluginState {
    ready = 'ready',        // Plugin is ready. No any operations
    busy = 'busy',          // Plugin isn't ready. Some blocked operations are going
    working = 'working',    // Plugin isn't ready, but can be used, because host has background operations
}

export interface IPluginState {
    message?: string;
    state?: EPluginState;
}

export class PluginState {
    public static States = EPluginState;
    public static signature: string = 'PluginState';
    public signature: string = PluginState.signature;

    public message: string = '';
    public state: EPluginState = EPluginState.ready;

    constructor(params: IPluginState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        this.message = typeof params.message === 'string' ? params.message : '';
        this.state = typeof params.state === 'string' ? params.state : EPluginState.ready;
    }
}

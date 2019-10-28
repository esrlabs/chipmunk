export enum ERenderState {
    ready = 'ready',        // Render is ready. No any operations
    busy = 'busy',          // Render isn't ready. Some blocked operations are going
    working = 'working',    // Render isn't ready, but can be used, because host has background operations
}

export interface IRenderState {
    message?: string;
    state: ERenderState;
}

export class RenderState {

    public static States = ERenderState;
    public static signature: string = 'RenderState';
    public signature: string = RenderState.signature;
    public message: string = '';
    public state: ERenderState = ERenderState.ready;

    constructor(params: IRenderState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for RenderState message`);
        }
        if (typeof params.state !== 'string' || params.state.trim() === '') {
            throw new Error(`State of render should be defined.`);
        }
        this.message = typeof params.message === 'string' ? params.message : '';
        this.state = params.state;
    }
}

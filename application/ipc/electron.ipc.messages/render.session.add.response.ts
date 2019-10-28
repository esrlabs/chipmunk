export interface IRenderSessionAddResponse {
    session: string;
    error?: string;
}

export class RenderSessionAddResponse {

    public static signature: string = 'RenderSessionAddResponse';
    public signature: string = RenderSessionAddResponse.signature;
    public session: string = '';
    public error: string | undefined;

    constructor(params: IRenderSessionAddResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for RenderSessionAddResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.session = params.session;
        this.error = params.error;
    }
}

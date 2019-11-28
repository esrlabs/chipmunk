export interface IDLTStatsCancelResponse {
    id: string;
    session: string;
    error?: string;
}

export class DLTStatsCancelResponse {

    public static signature: string = 'DLTStatsCancelResponse';
    public signature: string = DLTStatsCancelResponse.signature;
    public id: string = '';
    public error: string | undefined;
    public session: string = '';

    constructor(params: IDLTStatsCancelResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTStatsCancelResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`error should be defined.`);
        }
        this.id = params.id;
        this.session = params.session;
        this.error = params.error;
    }
}

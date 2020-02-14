
export interface IDLTDeamonSaveResponse {
    session: string;
    filename?: string;
    error?: string;
}

export class DLTDeamonSaveResponse {

    public static signature: string = 'DLTDeamonSaveResponse';
    public signature: string = DLTDeamonSaveResponse.signature;
    public session: string = '';
    public filename?: string;
    public error?: string;


    constructor(params: IDLTDeamonSaveResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonSaveResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.filename !== undefined && typeof params.filename !== 'string') {
            throw new Error(`filename should be defined.`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`error should be defined.`);
        }
        this.session = params.session;
        this.filename = params.filename;
        this.error = params.error;
    }
}

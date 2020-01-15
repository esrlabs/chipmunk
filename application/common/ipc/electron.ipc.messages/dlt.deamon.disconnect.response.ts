export interface IDLTDeamonDisconnectResponse {
    id: string;
    session: string;
    error?: string;
}

export class DLTDeamonDisconnectResponse {

    public static signature: string = 'DLTDeamonDisconnectResponse';
    public signature: string = DLTDeamonDisconnectResponse.signature;
    public id: string = '';
    public session: string = '';
    public error?: string;

    constructor(params: IDLTDeamonDisconnectResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonDisconnectResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.id = params.id;
        this.session = params.session;
        this.error = params.error;
    }
}

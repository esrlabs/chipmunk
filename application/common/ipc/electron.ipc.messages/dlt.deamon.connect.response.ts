export interface IDLTDeamonConnectResponse {
    id: string;
    session: string;
    error?: string;
}

export class DLTDeamonConnectResponse {

    public static signature: string = 'DLTDeamonConnectResponse';
    public signature: string = DLTDeamonConnectResponse.signature;
    public id: string = '';
    public session: string = '';
    public error?: string;

    constructor(params: IDLTDeamonConnectResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonConnectResponse message`);
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

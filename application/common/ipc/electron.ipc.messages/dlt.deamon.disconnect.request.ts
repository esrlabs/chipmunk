export interface IDLTDeamonDisconnectRequest {
    id: string;
    session: string;
}

export class DLTDeamonDisconnectRequest {

    public static signature: string = 'DLTDeamonDisconnectRequest';
    public signature: string = DLTDeamonDisconnectRequest.signature;
    public id: string = '';
    public session: string = '';
    public bindingAddress: string = '';
    public bindingPort: string = '';
    public multicastAddress: string = '';
    public multicastInterface: string = '';

    constructor(params: IDLTDeamonDisconnectRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonDisconnectRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.id = params.id;
        this.session = params.session;
    }
}

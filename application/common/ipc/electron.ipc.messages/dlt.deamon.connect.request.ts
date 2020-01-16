export interface IDLTDeamonConnectRequest {
    id: string;
    session: string;
    ecu: string;
    bindingAddress: string;
    bindingPort: string;
    multicastAddress: string;
    multicastInterface: string;
}

export class DLTDeamonConnectRequest {

    public static signature: string = 'DLTDeamonConnectRequest';
    public signature: string = DLTDeamonConnectRequest.signature;
    public id: string = '';
    public session: string = '';
    public ecu: string = '';
    public bindingAddress: string = '';
    public bindingPort: string = '';
    public multicastAddress: string = '';
    public multicastInterface: string = '';

    constructor(params: IDLTDeamonConnectRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonConnectRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.ecu !== 'string' || params.ecu.trim() === '') {
            throw new Error(`ecu should be defined.`);
        }
        if (typeof params.bindingAddress !== 'string' || params.bindingAddress.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.bindingPort !== 'string' || params.bindingPort.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.multicastAddress !== 'string') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.multicastInterface !== 'string') {
            throw new Error(`session should be defined.`);
        }
        this.id = params.id;
        this.session = params.session;
        this.ecu = params.ecu;
        this.bindingAddress = params.bindingAddress;
        this.bindingPort = params.bindingPort;
        this.multicastAddress = params.multicastAddress;
        this.multicastInterface = params.multicastInterface;
    }
}

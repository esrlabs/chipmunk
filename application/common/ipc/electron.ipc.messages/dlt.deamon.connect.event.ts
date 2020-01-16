export interface IDLTDeamonConnectEvent {
    id: string;
    session: string;
}

export class DLTDeamonConnectEvent {

    public static signature: string = 'DLTDeamonConnectEvent';
    public signature: string = DLTDeamonConnectEvent.signature;
    public id: string = '';
    public session: string = '';

    constructor(params: IDLTDeamonConnectEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonConnectEvent message`);
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

export interface IDLTDeamonDisconnectEvent {
    id: string;
    session: string;
}

export class DLTDeamonDisconnectEvent {

    public static signature: string = 'DLTDeamonDisconnectEvent';
    public signature: string = DLTDeamonDisconnectEvent.signature;
    public id: string = '';
    public session: string = '';

    constructor(params: IDLTDeamonDisconnectEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonDisconnectEvent message`);
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

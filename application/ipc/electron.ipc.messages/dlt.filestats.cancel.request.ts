export interface IDLTStatsCancelRequest {
    id: string;
    session: string;
}

export class DLTStatsCancelRequest {

    public static signature: string = 'DLTStatsCancelRequest';
    public signature: string = DLTStatsCancelRequest.signature;
    public id: string = '';
    public session: string = '';

    constructor(params: IDLTStatsCancelRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTStatsCancelRequest message`);
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

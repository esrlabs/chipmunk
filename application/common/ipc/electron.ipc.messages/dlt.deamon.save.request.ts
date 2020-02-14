
export interface IDLTDeamonSaveRequest {
    session: string;
    from?: number;
    to?: number;
}

export class DLTDeamonSaveRequest {

    public static signature: string = 'DLTDeamonSaveRequest';
    public signature: string = DLTDeamonSaveRequest.signature;
    public session: string = '';
    public from?: number;
    public to?: number;

    constructor(params: IDLTDeamonSaveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonSaveRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.from !== undefined && typeof params.from !== 'number') {
            throw new Error(`from should be defined.`);
        }
        if (params.to !== undefined && typeof params.to !== 'number') {
            throw new Error(`to should be defined.`);
        }
        this.session = params.session;
        this.from = params.from;
        this.to = params.to;
    }
}

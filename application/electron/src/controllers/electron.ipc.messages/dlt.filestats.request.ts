export interface IDLTStatsRequest {
    id: string;
    session: string;
    file: string;
}

export class DLTStatsRequest {

    public static signature: string = 'DLTStatsRequest';
    public signature: string = DLTStatsRequest.signature;
    public id: string = '';
    public file: string = '';
    public session: string = '';

    constructor(params: IDLTStatsRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTStatsRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.id = params.id;
        this.file = params.file;
        this.session = params.session;
    }
}

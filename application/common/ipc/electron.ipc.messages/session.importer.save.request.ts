
export interface ISessionImporterData {
    hash: number;
    data: string;
    controller: string;
}

export interface ISessionImporterSaveRequest {
    session: string;
    data: ISessionImporterData[];
}

export class SessionImporterSaveRequest {

    public static signature: string = 'SessionImporterSaveRequest';
    public signature: string = SessionImporterSaveRequest.signature;
    public session: string = '';
    public data: ISessionImporterData[];

    constructor(params: ISessionImporterSaveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SessionImporterSaveRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (!(params.data instanceof Array)) {
            throw new Error(`data should be ISessionImporterData[].`);
        }
        this.session = params.session;
        this.data = params.data;
    }
}

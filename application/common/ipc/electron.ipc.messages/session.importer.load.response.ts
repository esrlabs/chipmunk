
import { ISessionImporterData } from './session.importer.save.request';

export interface ISessionImporterLoadResponse {
    session: string;
    data?: ISessionImporterData[];
    error?: string;
}

export class SessionImporterLoadResponse {

    public static signature: string = 'SessionImporterLoadResponse';
    public signature: string = SessionImporterLoadResponse.signature;
    public session: string = '';
    public data?: ISessionImporterData[];
    public error?: string;

    constructor(params: ISessionImporterLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SessionImporterLoadResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.data !== undefined && !(params.data instanceof Array)) {
            throw new Error(`data should be ISessionImporterData[].`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`error should be defined.`);
        }
        this.session = params.session;
        this.data = params.data;
        this.error = params.error;
    }
}


export interface ISessionImporterSaveResponse {
    session: string;
    error?: string;
}

export class SessionImporterSaveResponse {

    public static signature: string = 'SessionImporterSaveResponse';
    public signature: string = SessionImporterSaveResponse.signature;
    public session: string = '';
    public filename?: string;
    public error?: string;


    constructor(params: ISessionImporterSaveResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SessionImporterSaveResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`error should be defined.`);
        }
        this.session = params.session;
        this.error = params.error;
    }

}

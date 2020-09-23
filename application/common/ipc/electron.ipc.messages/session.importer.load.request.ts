export interface ISessionImporterLoadRequest {
    session: string;
}

export class SessionImporterLoadRequest {

    public static signature: string = 'SessionImporterLoadRequest';
    public signature: string = SessionImporterLoadRequest.signature;
    public session: string = '';

    constructor(params: ISessionImporterLoadRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SessionImporterLoadRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.session = params.session;
    }

}

export interface IFileGetOptionsRequest {
    session: string;
    filename: string;
}

export class FileGetOptionsRequest {

    public static signature: string = 'FileGetOptionsRequest';
    public signature: string = FileGetOptionsRequest.signature;
    public session: string = '';
    public filename: string = '';

    constructor(params: IFileGetOptionsRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileGetOptionsRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.filename !== 'string' || params.filename.trim() === '') {
            throw new Error(`filename should be defined.`);
        }
        this.session = params.session;
        this.filename = params.filename;
    }
}

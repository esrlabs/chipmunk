export interface IFileOpenRequest {
    file: string;
    session: string;
    options?: any;
}

export class FileOpenRequest {

    public static signature: string = 'FileOpenRequest';
    public signature: string = FileOpenRequest.signature;
    public file: string = '';
    public session: string = '';
    public options?: string = '';

    constructor(params: IFileOpenRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.file = params.file;
        this.session = params.session;
        this.options = params.options;
    }
}

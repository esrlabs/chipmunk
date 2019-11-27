export interface IFileReadRequest {
    file: string;
    bytes: number;
    session: string;
}

export class FileReadRequest {

    public static signature: string = 'FileReadRequest';
    public signature: string = FileReadRequest.signature;
    public file: string = '';
    public bytes: number = 0;
    public session: string = '';

    constructor(params: IFileReadRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileReadRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.bytes !== 'number' || isNaN(params.bytes) || !isFinite(params.bytes)) {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.file = params.file;
        this.session = params.session;
        this.bytes = params.bytes;
    }
}

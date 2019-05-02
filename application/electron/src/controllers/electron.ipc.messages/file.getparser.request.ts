export interface IFileGetParserRequest {
    file: string;
}

export class FileGetParserRequest {

    public static signature: string = 'FileGetParserRequest';
    public signature: string = FileGetParserRequest.signature;
    public file: string = '';

    constructor(params: IFileGetParserRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileGetParserRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.file = params.file;
    }
}

export interface IFileUnsupportedRequest {
    file: string;
}

export class FileUnsupportedRequest {
    public static signature: string = 'FileUnsupportedRequest';
    public signature: string = FileUnsupportedRequest.signature;
    public file: string = '';

    constructor(params: IFileUnsupportedRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileUnsupportedRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.file = params.file;
    }
}

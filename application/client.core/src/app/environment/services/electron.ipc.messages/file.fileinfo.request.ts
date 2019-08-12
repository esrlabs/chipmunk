export interface IFileInfoRequest {
    file: string;
}

export class FileInfoRequest {

    public static signature: string = 'FileInfoRequest';
    public signature: string = FileInfoRequest.signature;
    public file: string = '';

    constructor(params: IFileInfoRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileInfoRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.file = params.file;
    }
}

export interface IFileOpenRequest {
    file: string;
}

export class FileOpenRequest {

    public static signature: string = 'FileOpenRequest';
    public signature: string = FileOpenRequest.signature;
    public file: string = '';

    constructor(params: IFileOpenRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.file = params.file;
    }
}

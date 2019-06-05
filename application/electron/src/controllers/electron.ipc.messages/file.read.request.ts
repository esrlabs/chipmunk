export interface IFileReadRequest {
    file: string;
    bytes: number;
}

export class FileReadRequest {

    public static signature: string = 'FileReadRequest';
    public signature: string = FileReadRequest.signature;
    public file: string = '';
    public bytes: number = 0;

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
        this.file = params.file;
        this.bytes = params.bytes;
    }
}

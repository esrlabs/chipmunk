export interface IFileUnsupported {
    file: string;
}

export class FileUnsupported {
    public static signature: string = 'FileUnsupported';
    public signature: string = FileUnsupported.signature;
    public file: string = '';

    constructor(params: IFileUnsupported) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileUnsupported message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.file = params.file;
    }
}

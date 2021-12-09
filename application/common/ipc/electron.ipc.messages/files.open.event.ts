export interface IFilesOpenEvent {
    files: string[];
}

export class FilesOpenEvent {
    public static signature: string = 'FilesOpenEvent';
    public signature: string = FilesOpenEvent.signature;
    public files: string[];

    constructor(params: IFilesOpenEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FilesOpenEvent message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`Expecting files to be an Array<string>`);
        }
        this.files = params.files;
    }
}

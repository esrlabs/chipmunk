export interface IFile {
    file: string;
    found: number;
    readBytes: number;
    readRows: number;
    size: number;
    regExpStr: string;
    error?: string;
}

export interface IMergeFilesTestResponse {
    id: string;
    files: IFile[];
}

export class MergeFilesTestResponse {

    public static signature: string = 'MergeFilesTestResponse';
    public signature: string = MergeFilesTestResponse.signature;
    public id: string = '';
    public files: IFile[] = [];

    constructor(params: IMergeFilesTestResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesTestResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.files !== undefined && !(params.files instanceof Array)) {
            throw new Error(`parsers should be defined as Array<IFile>.`);
        }
        this.id = params.id;
        this.files = params.files;
    }
}

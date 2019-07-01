export interface IFile {
    file: string;
    parser: string;
    format: string;
}

export interface IMergeFilesTestRequest {
    id: string;
    files: IFile[];
}

export class MergeFilesTestRequest {

    public static signature: string = 'MergeFilesTestRequest';
    public signature: string = MergeFilesTestRequest.signature;
    public id: string = '';
    public timezone: string = '';
    public files: IFile[] = [];

    constructor(params: IMergeFilesTestRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesTestRequest message`);
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

export interface IFile {
    file: string;
    parser: string;
    offset: number;
    format: string;
    zone: string;
    year?: number;
}

export interface IMergeFilesRequest {
    id: string;
    files: IFile[];
    session: string;
}

export class MergeFilesRequest {

    public static signature: string = 'MergeFilesRequest';
    public signature: string = MergeFilesRequest.signature;
    public id: string = '';
    public timezone: string = '';
    public files: IFile[] = [];
    public session: string = '';

    constructor(params: IMergeFilesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.files !== undefined && !(params.files instanceof Array)) {
            throw new Error(`parsers should be defined as Array<IFile>.`);
        }
        this.id = params.id;
        this.files = params.files;
        this.session = params.session;
    }
}

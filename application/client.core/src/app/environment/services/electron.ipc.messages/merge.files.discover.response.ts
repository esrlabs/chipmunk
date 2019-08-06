export interface IMergeFilesDiscoverResult {
    format: string;
    path: string;
    error?: string;
}

export interface IMergeFilesDiscoverResponse {
    id: string;
    error?: string;
    files: IMergeFilesDiscoverResult[];
}

export class MergeFilesDiscoverResponse {

    public static signature: string = 'MergeFilesDiscoverResponse';
    public signature: string = MergeFilesDiscoverResponse.signature;
    public id: string = '';
    public error?: string;
    public files: IMergeFilesDiscoverResult[] = [];

    constructor(params: IMergeFilesDiscoverResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesDiscoverResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.files !== undefined && !(params.files instanceof Array)) {
            throw new Error(`parsers should be defined as Array<IMergeFilesDiscoverResult>.`);
        }
        this.id = params.id;
        this.error = params.error;
        this.files = params.files;
    }
}

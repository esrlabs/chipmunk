export interface IMergeFilesDiscoverRequest {
    id: string;
    files: string[];
}

export class MergeFilesDiscoverRequest {

    public static signature: string = 'MergeFilesDiscoverRequest';
    public signature: string = MergeFilesDiscoverRequest.signature;
    public id: string = '';
    public files: string[] = [];

    constructor(params: IMergeFilesDiscoverRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesDiscoverRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.files !== undefined && !(params.files instanceof Array)) {
            throw new Error(`parsers should be defined as Array<string>.`);
        }
        this.id = params.id;
        this.files = params.files;
    }
}

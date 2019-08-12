export interface IRegExpStr {
    source: string;
    flags: string;
}

export interface IFilesSearchRequest {
    files: string[];
    requests: IRegExpStr[];
}

export class FilesSearchRequest {

    public static signature: string = 'FilesSearchRequest';
    public signature: string = FilesSearchRequest.signature;
    public files: string[] = [];
    public requests: IRegExpStr[] = [];

    constructor(params: IFilesSearchRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FilesSearchRequest message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`files should be defined.`);
        }
        if (!(params.requests instanceof Array)) {
            throw new Error(`requests should be defined.`);
        }
        this.files = params.files;
        this.requests = params.requests;
    }
}

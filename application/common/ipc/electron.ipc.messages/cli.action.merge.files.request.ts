export interface ICLIActionMergeFilesRequest {
    files: string[];
}

export class CLIActionMergeFilesRequest{

    public static signature: string = 'CLIActionMergeFilesRequest';
    public signature: string = CLIActionMergeFilesRequest.signature;
    public files: string[] = [];

    constructor(params: ICLIActionMergeFilesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for CLIActionMergeFilesRequest message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`files should be defined as an array.`);
        }
        this.files = params.files;
    }
}

export interface ICLIActionConcatFilesRequest {
    files: string[];
}

export class CLIActionConcatFilesRequest{

    public static signature: string = 'CLIActionConcatFilesRequest';
    public signature: string = CLIActionConcatFilesRequest.signature;
    public files: string[] = [];

    constructor(params: ICLIActionConcatFilesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for CLIActionConcatFilesRequest message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`files should be defined as an array.`);
        }
        this.files = params.files;
    }
}

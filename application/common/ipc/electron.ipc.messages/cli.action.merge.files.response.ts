export interface ICLIActionMergeFilesResponse {
    error?: string;
}

export class CLIActionMergeFilesResponse{

    public static signature: string = 'CLIActionMergeFilesResponse';
    public signature: string = CLIActionMergeFilesResponse.signature;
    public error?: string;

    constructor(params: ICLIActionMergeFilesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for CLIActionMergeFilesResponse message`);
        }
        this.error = params.error;
    }
}

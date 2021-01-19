export interface ICLIActionConcatFilesResponse {
    error?: string;
}

export class CLIActionConcatFilesResponse{

    public static signature: string = 'CLIActionConcatFilesResponse';
    public signature: string = CLIActionConcatFilesResponse.signature;
    public error?: string;

    constructor(params: ICLIActionConcatFilesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for CLIActionConcatFilesResponse message`);
        }
        this.error = params.error;
    }
}

export interface ICLIActionOpenFileResponse {
    error?: string;
}

export class CLIActionOpenFileResponse{

    public static signature: string = 'CLIActionOpenFileResponse';
    public signature: string = CLIActionOpenFileResponse.signature;
    public error?: string;

    constructor(params: ICLIActionOpenFileResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for CLIActionOpenFileResponse message`);
        }
        this.error = params.error;
    }
}

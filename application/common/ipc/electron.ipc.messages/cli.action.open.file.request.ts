export interface ICLIActionOpenFileRequest {
    file: string;
}

export class CLIActionOpenFileRequest{

    public static signature: string = 'CLIActionOpenFileRequest';
    public signature: string = CLIActionOpenFileRequest.signature;
    public file: string = '';

    constructor(params: ICLIActionOpenFileRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for CLIActionOpenFileRequest message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.file = params.file;
    }
}

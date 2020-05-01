export interface IMergeFilesFormatResponse {
    error?: string;
}

export class MergeFilesFormatResponse {

    public static signature: string = 'MergeFilesFormatResponse';
    public signature: string = MergeFilesFormatResponse.signature;
    public error?: string;

    constructor(params: IMergeFilesFormatResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesFormatResponse message`);
        }
        this.error = params.error;
    }
}

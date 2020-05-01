

export interface IMergeFilesFormatRequest {
    format: string;
    year?: number;
}

export class MergeFilesFormatRequest {

    public static signature: string = 'MergeFilesFormatRequest';
    public signature: string = MergeFilesFormatRequest.signature;
    public format: string;
    public year?: number;


    constructor(params: IMergeFilesFormatRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesTestRequest message`);
        }
        if (typeof params.format !== 'string' || params.format.trim() === '') {
            throw new Error(`format should be defined.`);
        }
        this.format = params.format;
        this.year = params.year;
    }
}

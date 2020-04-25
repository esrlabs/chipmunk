

export interface IMergeFilesTestRequest {
    id: string;
    file: string;
    format?: string;
    year?: number;
}

export class MergeFilesTestRequest {

    public static signature: string = 'MergeFilesTestRequest';
    public signature: string = MergeFilesTestRequest.signature;
    public id: string = '';
    public file: string = '';
    public format?: string;
    public year?: number;


    constructor(params: IMergeFilesTestRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesTestRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        this.id = params.id;
        this.file = params.file;
        this.format = params.format;
        this.year = params.year;
    }
}

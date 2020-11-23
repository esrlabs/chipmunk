export interface IMergeFilesResponse {
    id: string;
    error?: string;
}

export class MergeFilesResponse {

    public static signature: string = 'MergeFilesResponse';
    public signature: string = MergeFilesResponse.signature;
    public id: string = '';
    public error: string | undefined;

    constructor(params: IMergeFilesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for MergeFilesResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`error should be defined.`);
        }
        this.id = params.id;
        this.error = params.error;
    }
}

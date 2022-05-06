export interface IMergeFilesResponse {
    id: string;
    written: number;
    error?: string;
}

export class MergeFilesResponse {

    public static signature: string = 'MergeFilesResponse';
    public signature: string = MergeFilesResponse.signature;
    public id: string = '';
    public error: string | undefined;
    public written: number = 0;

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
        if (typeof params.written !== 'number' || isNaN(params.written) || !isFinite(params.written)) {
            throw new Error(`written should be defined.`);
        }
        this.id = params.id;
        this.written = params.written;
        this.error = params.error;
    }
}

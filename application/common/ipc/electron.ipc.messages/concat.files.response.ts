export interface IConcatFilesResponse {
    id: string;
    error?: string;
}

export class ConcatFilesResponse {

    public static signature: string = 'ConcatFilesResponse';
    public signature: string = ConcatFilesResponse.signature;
    public id: string = '';
    public error: string | undefined;

    constructor(params: IConcatFilesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ConcatFilesResponse message`);
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

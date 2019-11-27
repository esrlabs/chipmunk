
export interface IFiltersSaveResponse {
    filename: string;
    error?: string;
}

export class FiltersSaveResponse {

    public static signature: string = 'FiltersSaveResponse';
    public signature: string = FiltersSaveResponse.signature;
    public filename: string = '';
    public error?: string;

    constructor(params: IFiltersSaveResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersSaveResponse message`);
        }
        if (typeof params.filename !== 'string' || params.filename.trim() === '') {
            throw new Error(`filename should be defined.`);
        }
        this.filename = params.filename;
        this.error = params.error;
    }
}

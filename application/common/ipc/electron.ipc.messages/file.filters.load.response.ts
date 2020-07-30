export interface IFiltersLoadResponse {
    store?: string;
    file: string;
    error?: string;
}

export class FiltersLoadResponse {

    public static signature: string = 'FiltersLoadResponse';
    public signature: string = FiltersLoadResponse.signature;
    public store?: string = '';
    public file: string;
    public error?: string;

    constructor(params: IFiltersLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersLoadResponse message`);
        }
        this.file = params.file;
        this.store = params.store;
        this.error = params.error;
    }
}

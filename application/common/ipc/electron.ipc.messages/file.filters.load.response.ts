export interface IFilter {
    reg: string;
    color: string;
    background: string;
    active: boolean;
}
export interface IFiltersLoadResponse {
    filters: IFilter[];
    file: string;
    error?: string;
}

export class FiltersLoadResponse {

    public static signature: string = 'FiltersLoadResponse';
    public signature: string = FiltersLoadResponse.signature;
    public filters: IFilter[] = [];
    public file: string;
    public error?: string;

    constructor(params: IFiltersLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersLoadResponse message`);
        }
        if (!(params.filters instanceof Array) || params.filters.length === 0) {
            throw new Error(`size should be filters.`);
        }
        this.file = params.file;
        this.filters = params.filters;
        this.error = params.error;
    }
}

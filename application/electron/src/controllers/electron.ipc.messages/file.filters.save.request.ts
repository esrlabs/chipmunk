export interface IFilter {
    reg: string;
    color: string;
    background: string;
    active: boolean;
}
export interface IFiltersSaveRequest {
    filters: IFilter[];
    file: string | undefined;
}

export class FiltersSaveRequest {

    public static signature: string = 'FiltersSaveRequest';
    public signature: string = FiltersSaveRequest.signature;
    public filters: IFilter[] = [];
    public file: string | undefined;

    constructor(params: IFiltersSaveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersSaveRequest message`);
        }
        if (!(params.filters instanceof Array) || params.filters.length === 0) {
            throw new Error(`size should be filters.`);
        }
        this.file = params.file;
        this.filters = params.filters;
    }
}

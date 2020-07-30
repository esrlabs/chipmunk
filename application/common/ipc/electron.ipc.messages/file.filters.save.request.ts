
export interface IFiltersSaveRequest {
    store: string;
    count: number;
    file: string | undefined;
}

export class FiltersSaveRequest {

    public static signature: string = 'FiltersSaveRequest';
    public signature: string = FiltersSaveRequest.signature;
    public store: string;
    public count: number;
    public file: string | undefined;

    constructor(params: IFiltersSaveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersSaveRequest message`);
        }
        if (typeof params.store !== 'string' || params.store.trim() === '') {
            throw new Error(`store should be not empty string`);
        }
        if (typeof params.count !== 'number' || isNaN(params.count) || !isFinite(params.count)) {
            throw new Error(`count should be number`);
        }
        this.file = params.file;
        this.count = params.count;
        this.store = params.store;
    }
}

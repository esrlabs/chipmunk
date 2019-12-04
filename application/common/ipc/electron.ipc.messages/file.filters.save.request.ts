export interface IFilter {
    reg: string;
    color: string;
    background: string;
    active: boolean;
}
export enum EChartType {
    scatter = 'scatter',
}
export interface IChart {
    reg: string;
    color: string;
    type: EChartType,
    active: boolean;
}
export interface IFiltersSaveRequest {
    filters: IFilter[];
    charts: IChart[];
    file: string | undefined;
}

export class FiltersSaveRequest {

    public static signature: string = 'FiltersSaveRequest';
    public signature: string = FiltersSaveRequest.signature;
    public filters: IFilter[] = [];
    public charts: IChart[] = [];
    public file: string | undefined;

    constructor(params: IFiltersSaveRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersSaveRequest message`);
        }
        if (!(params.filters instanceof Array)) {
            throw new Error(`filters should be IFilter[]`);
        }
        if (!(params.charts instanceof Array)) {
            throw new Error(`charts should be IChart[]`);
        }
        this.file = params.file;
        this.filters = params.filters;
        this.charts = params.charts;
    }
}

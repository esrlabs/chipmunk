import { IFilter, IChart } from './file.filters.save.request';

export interface IFiltersLoadResponse {
    filters: IFilter[];
    charts: IChart[];
    file: string;
    error?: string;
}

export class FiltersLoadResponse {

    public static signature: string = 'FiltersLoadResponse';
    public signature: string = FiltersLoadResponse.signature;
    public filters: IFilter[] = [];
    public charts: IChart[] = [];
    public file: string;
    public error?: string;

    constructor(params: IFiltersLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FiltersLoadResponse message`);
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
        this.error = params.error;
    }
}

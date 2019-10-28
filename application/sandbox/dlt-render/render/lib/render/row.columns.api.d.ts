import * as Toolkit from 'chipmunk.client.toolkit';
export declare const CDelimiters: {
    columns: string;
    arguments: string;
};
export declare const CColumnsHeaders: string[];
export declare class DLTRowColumnsAPI extends Toolkit.ATypedRowRenderAPIColumns {
    constructor();
    getHeaders(): string[];
    getColumns(str: string): string[];
    getDefaultWidths(): Array<{
        width: number;
        min: number;
    }>;
}

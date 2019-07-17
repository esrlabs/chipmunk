import * as Toolkit from 'logviewer.client.toolkit';
export declare class DLTRowColumnsAPI extends Toolkit.ATypedRowRenderAPIColumns {
    constructor();
    getHeaders(): string[];
    getColumns(str: string): string[];
    getDefaultWidths(): Array<{
        width: number;
        min: number;
    }>;
}

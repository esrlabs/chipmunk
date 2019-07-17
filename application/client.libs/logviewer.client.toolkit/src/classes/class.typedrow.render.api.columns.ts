export interface IColumnWidth {
    width: number;
    min: number;
}

export abstract class ATypedRowRenderAPIColumns {

    public abstract getHeaders(): string[];
    public abstract getColumns(str: string): string[];
    public abstract getDefaultWidths(): IColumnWidth[];

}

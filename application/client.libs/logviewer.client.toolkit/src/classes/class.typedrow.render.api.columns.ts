export interface IColumnWidth {
    width: number;
    min: number;
}

const CSignature = 'ATypedRowRenderAPIColumns';

export abstract class ATypedRowRenderAPIColumns {

    public getClassSignature(): string {
        return CSignature;
    }

    public static isInstance(smth: any): boolean {
        if (typeof smth !== 'object' || smth === null) {
            return false;
        }
        if (typeof smth.getClassSignature !== 'function') {
            return false;
        }
        return smth.getClassSignature() === CSignature;
    }

    public abstract getHeaders(): string[];
    public abstract getColumns(str: string): string[];
    public abstract getDefaultWidths(): IColumnWidth[];

}

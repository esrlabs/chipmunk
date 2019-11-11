export interface IColumnWidth {
    width: number;
    min: number;
}

const CSignature = 'ATypedRowRenderAPIColumns';

/**
 * Allows to present line of stream as collection of columns.
 * It should be used with ATypedRowRender class (as generic class), like:
 *
 * class ATypedRowRender<ATypedRowRenderAPIColumns> { ... }
 *
 * @usecases decode / convert line of stream and show it as columns
 * @requirements TypeScript or JavaScript
 * @class ATypedRowRenderAPIColumns
 */
export abstract class ATypedRowRenderAPIColumns {
    /**
     * Internal usage
     */
    public getClassSignature(): string {
        return CSignature;
    }

    /**
     * Internal usage
     */
    public static isInstance(smth: any): boolean {
        if (typeof smth !== 'object' || smth === null) {
            return false;
        }
        if (typeof smth.getClassSignature !== 'function') {
            return false;
        }
        return smth.getClassSignature() === CSignature;
    }

    /**
     * Should returns headers of columns
     * @returns {string[]} headers of columns
     */
    public abstract getHeaders(): string[];

    /**
     * Should return valuses of columns
     * @param {string} str - single line from stream
     * @returns {string[]} values of columns
     */
    public abstract getColumns(str: string): string[];

    /**
     * Should return default widths of columns
     * @returns {IColumnWidth[]} widths of columns
     */
    public abstract getDefaultWidths(): IColumnWidth[];

}

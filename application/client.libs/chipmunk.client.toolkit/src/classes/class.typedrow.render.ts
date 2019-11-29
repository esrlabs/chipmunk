import { ETypedRowRenders } from '../consts/enums';

const CSignature = 'ATypedRowRender';

/**
 * This class is used for more complex renders of stream output. Like:
 * - ATypedRowRenderAPIColumns - to show stream line as columns
 * - ATypedRowRenderAPIExternal - to use custom Angular component as stream
 * line render
 *
 * @usecases to show content in columns; to have full HTML/LESS features for rendering
 * @class ATypedRowRender
 */
export abstract class ATypedRowRender<T> {

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
     * This method will be called for each line of a stream before method "parse" will be called.
     * @param {string} sourceName - name of source
     * @returns {boolean} - true - method "parse" will be called for this line; false - parser will be ignored
     */
    public abstract isTypeMatch(sourceName: string): boolean;

    /**
     * This method will return one of the supported types of custom renders:
     * - columns
     * - external
     * @returns {ETypedRowRenders} - type of custom render
     */
    public abstract getType(): ETypedRowRenders;

    /**
     * Should return an implementation of custom render. An instance of one of the next renders:
     * - ATypedRowRenderAPIColumns
     * - ATypedRowRenderAPIExternal
     */
    public abstract getAPI(): T;

}

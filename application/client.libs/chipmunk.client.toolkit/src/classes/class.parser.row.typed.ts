import { EThemeType } from '../consts/enums';
import { IRowInfo } from '../interfaces/row';
import { Modifier } from './class.row.modifier';

const CSignature = 'RowTypedParser';

/**
 * Allows creating row parser with checking the type of source before.
 * It means this parser could be bound with some specific type of source,
 * for example with some specific file's type (DLT, log and so on)
 * @usecases decoding stream output content; converting stream output into human-readable format
 * @requirements TypeScript or JavaScript
 * @examples Base64string parser, HEX converting into a string and so on
 * @class RowTypedParser
 */
export abstract class RowTypedParser {

    /**
     * Internal usage
     */
    public static getClassSignature(): string {
        return CSignature;
    }

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
        if (smth === undefined || smth === null) {
            return false;
        }
        if (typeof smth.getClassSignature !== 'function') {
            return false;
        }
        return smth.getClassSignature() === CSignature;
    }

    /**
     * This method will be called with each line in stream
     * @param {string} str - single line from stream
     * @param {EThemeType} themeTypeRef - reference to active theme (dark, light and so on)
     * @param {IRowInfo} row - information about current row (see IRowInfo for more details)
     * @returns {string} method should return a string.
     */
    public abstract parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string | Modifier | undefined;

    /**
     * This method will be called for each line of stream before method "parse" will be called.
     * @param {string} sourceName - name of source
     * @param {string} sourceMeta - optional description of source
     * @returns {boolean} - true - method "parse" will be called for this line; false - parser will be ignored
     */
    public abstract isTypeMatch(sourceName: string, sourceMeta?: string): boolean;

    /**
     * This method will be called with each line in stream to get row modifier
     * @param {string} str - single line from stream
     * @param {EThemeType} themeTypeRef - reference to active theme (dark, light and so on)
     * @param {IRowInfo} row - information about current row (see IRowInfo for more details)
     * @returns {string} method should return a string.
     */
    // public abstract getModifier(str: string, themeTypeRef: EThemeType, row: IRowInfo): Modifier;

}

// Back compatibility (from 0.0.87)
export { RowTypedParser as ARowTypedParser };

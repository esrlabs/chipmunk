import { EThemeType } from '../consts/enums';
import { IRowInfo } from '../interfaces/row';

const CSignature = 'ARowTypedParser';

/**
 * Allows to create row parser with checking type of source before.
 * It means this parser could be bound with some specific type of source,
 * for example with some specific file's type (DLT, log and so on)
 * @usecases decoding stream output content; convertinng stream output into human-readable format
 * @requirements TypeScript or JavaScript
 * @examples Base64string parser, HEX converting into string and so on
 * @class ARowTypedParser
 */
export abstract class ARowTypedParser {

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
     * This method will be called with each line in stream
     * @param {string} str - single line from stream
     * @param {EThemeType} themeTypeRef - reference to active theme (dark, light and so on)
     * @param {IRowInfo} row - information about current row (see IRowInfo for more details)
     * @returns {string} method should return a string.
     */
    public abstract parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string;

    /**
     * This method will be called for each line of stream before method "parse" will be called.
     * @param {string} sourceName - name of source
     * @returns {boolean} - true - method "parse" will be called for this line; false - parser will be ignored
     */
    public abstract isTypeMatch(sourceName: string): boolean;

}

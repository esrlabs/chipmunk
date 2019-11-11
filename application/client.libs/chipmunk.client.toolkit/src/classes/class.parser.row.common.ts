import { EThemeType } from '../consts/enums';
import { IRowInfo } from '../interfaces/row';

const CSignature = 'ARowCommonParser';

/**
 * Allows to create row parser, which will be applyed to each new line in stream.
 * @usecases decoding stream output content; convertinng stream output into human-readable format
 * @requirements TypeScript or JavaScript
 * @examples Base64string parser, HEX converting into string and so on
 * @class ARowCommonParser
 */
export abstract class ARowCommonParser {

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

}

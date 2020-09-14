import { EThemeType } from '../consts/enums';
import { IRowInfo } from '../interfaces/row';
import { Modifier } from './class.row.modifier';

const CSignature = 'RowBoundParser';

/**
 * Allows creating row parser, which will bound with plugin's host.
 * It means: this row parser will be applied only to data, which was
 * received from plugin's host.
 * It also means: usage of this kind of plugin makes sense only if plugin has
 * host part (backend part), which delivery some data. A good example would be:
 * serial port plugin. Host part extracts data from serial port and sends into
 * stream; render (this kind of plugin) applies only to data, which were gotten
 * from serial port.
 * @usecases decoding stream output content; converting stream output into human-readable format
 * @requirements TypeScript or JavaScript
 * @examples Base64string parser, HEX converting into a string and so on
 * @class RowBoundParser
 */
export abstract class RowBoundParser {

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
     * This method will be called with each line in stream was gotten from plugin's host
     * @param {string} str - single line from stream (comes only from plugin's host)
     * @param {EThemeType} themeTypeRef - reference to active theme (dark, light and so on)
     * @param {IRowInfo} row - information about current row (see IRowInfo for more details)
     * @returns {string} method should return a string.
     */
    public abstract parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string | Modifier | undefined;

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
export { RowBoundParser as ARowBoundParser };

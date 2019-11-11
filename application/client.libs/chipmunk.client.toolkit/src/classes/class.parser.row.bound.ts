import { EThemeType } from '../consts/enums';
import { IRowInfo } from '../interfaces/row';

const CSignature = 'ARowBoundParser';

/**
 * Allows to create row parser, which will bound with plugin's host.
 * It means: this row parser will be applyed only to data, which was
 * recieved from plugin's host.
 * It also means: usage of this kind of plugin makes sense only if plugin has
 * host part (backend part), which delivery some data. Good example would be:
 * serial port plugin. Host part extracts data from serial port and sends into
 * stream; render (this kind of plugin) applys only to data, which were gotten
 * from serial port.
 * @usecases decoding stream output content; convertinng stream output into human-readable format
 * @requirements TypeScript or JavaScript
 * @examples Base64string parser, HEX converting into string and so on
 * @class ARowBoundParser
 */
export abstract class ARowBoundParser {

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
     * This method will be called with each line in stream was gotten from plugin's host
     * @param {string} str - single line from stream (comes only from plugin's host)
     * @param {EThemeType} themeTypeRef - reference to active theme (dark, light and so on)
     * @param {IRowInfo} row - information about current row (see IRowInfo for more details)
     * @returns {string} method should return a string.
     */
    public abstract parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string;

}

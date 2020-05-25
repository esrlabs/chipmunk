import { EThemeType } from '../consts/enums';
import { THTMLString } from '../types/index';

const CSignature = 'SelectionParser';

/**
 * Allows creating parser of selection.
 * Name of the parser will be shown in the context menu of selection. If a user selects parser,
 * parser will be applied to selection and result will be shown on tab "Details"
 * @usecases decoding selected content; converting selected content into human-readable format
 * @requirements TypeScript or JavaScript
 * @examples encrypting of data, Base64string parser, HEX converting into a string and so on
 * @class SelectionParser
 */
export abstract class SelectionParser {

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
     * This method will be called on user selection
     * @param {string} str - selection in main view or search results view
     * @param {EThemeType} themeTypeRef - reference to active theme (dark, light and so on)
     * @returns {string} method should return a string or HTML string
     */
    public abstract parse(str: string, themeTypeRef: EThemeType): string | THTMLString;

    /**
     * Should return name of parser to be shown in context menu of selection
     * @param {string} str - selection in main view or search results view
     * @returns {string} name of parser
     */
    public abstract getParserName(str: string): string | undefined;

}

// Back compatibility (from 0.0.87)
export { SelectionParser as ASelectionParser };

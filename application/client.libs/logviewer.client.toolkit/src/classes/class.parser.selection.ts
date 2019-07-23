import { EThemeType } from '../consts/enums';
import { THTMLString } from '../types/index';

const CSignature = 'ASelectionParser';

export abstract class ASelectionParser {

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

    public abstract parse(str: string, themeTypeRef: EThemeType): string | THTMLString;

    public abstract getParserName(str: string): string | undefined;

}

import { EThemeType } from '../consts/enums';

const CSignature = 'ARowCommonParser';

export abstract class ARowCommonParser {

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

    public abstract parse(str: string, themeTypeRef: EThemeType): string;

}

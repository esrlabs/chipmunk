import { EThemeType } from '../consts/enums';
import { IRowInfo } from '../interfaces/row';

const CSignature = 'ARowTypedParser';

export abstract class ARowTypedParser {

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

    public abstract parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string;
    public abstract isTypeMatch(sourceName: string): boolean;

}

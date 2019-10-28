import { ETypedRowRenders } from '../consts/enums';

const CSignature = 'ATypedRowRender';

export abstract class ATypedRowRender<T> {

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

    public abstract isTypeMatch(sourceName: string): boolean;
    public abstract getType(): ETypedRowRenders;
    public abstract getAPI(): T;

}

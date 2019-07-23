const CSignature = 'ATypedRowRenderAPIExternal';

export abstract class ATypedRowRenderAPIExternal {

    private _factory: any;

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

    public abstract getSelector(): string;
    public abstract getInputs(): { [key: string]: any };

    public setFactory(factory: any) {
        this._factory = factory;
    }

    public getFactory(): any {
        return this._factory;
    }
}

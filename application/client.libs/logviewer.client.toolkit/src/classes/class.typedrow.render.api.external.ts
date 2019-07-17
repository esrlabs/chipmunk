
export abstract class ATypedRowRenderAPIExternal {

    private _factory: any;

    public abstract getSelector(): string;
    public abstract getInputs(): { [key: string]: any };

    public setFactory(factory: any) {
        this._factory = factory;
    }

    public getFactory(): any {
        return this._factory;
    }
}

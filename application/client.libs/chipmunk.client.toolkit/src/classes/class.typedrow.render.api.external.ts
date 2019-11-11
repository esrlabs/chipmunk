const CSignature = 'ATypedRowRenderAPIExternal';

/**
 * Allows inject Angualr component into view as each row render
 * It should be used with ATypedRowRender class (as generic class), like:
 *
 * class ATypedRowRender<ATypedRowRenderAPIExternal> { ... }
 *
 * @usecases decode / convert line of stream and show with specific render
 * @requirements Angualr, TypeScript
 * @class ATypedRowRenderAPIExternal
 */
export abstract class ATypedRowRenderAPIExternal {

    /**
     * Internal usage
     */
    private _factory: any;

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
     * This method should return angular's compenent selector.
     * Note: plugin should already have implementation of component,
     * which will be used as render. Selector of such compenent should
     * be returned here.
     * @returns {string} angular's compenent selector
     */
    public abstract getSelector(): string;

    /**
     * Method returs inputs for render component
     * @returns { { [key: string]: any } } inputs for render-components
     */
    public abstract getInputs(): { [key: string]: any };

    /**
     * Internal usage
     */
    public setFactory(factory: any) {
        this._factory = factory;
    }

    /**
     * Internal usage
     */
    public getFactory(): any {
        return this._factory;
    }
}

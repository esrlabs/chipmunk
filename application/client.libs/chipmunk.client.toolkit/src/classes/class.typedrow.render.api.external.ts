const CSignature = 'TypedRowRenderAPIExternal';

/**
 * Allows injecting Angular component into view as each row render
 * It should be used with TypedRowRender class (as a generic class), like:
 *
 * class TypedRowRender<TypedRowRenderAPIExternal> { ... }
 *
 * @usecases decode / convert line of stream and show with specific render
 * @requirements Angualr, TypeScript
 * @class TypedRowRenderAPIExternal
 */
export abstract class TypedRowRenderAPIExternal {

    /**
     * Internal usage
     */
    private _factory: any;

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
     * This method should return angular's component selector.
     * Note: plugin should already have an implementation of the component,
     * which will be used as render. Selector of such component should
     * be returned here.
     * @returns {string} angular's component selector
     */
    public abstract getSelector(): string;

    /**
     * Method returns inputs for render component
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

// Back compatibility (from 0.0.87)
export { TypedRowRenderAPIExternal as ATypedRowRenderAPIExternal };

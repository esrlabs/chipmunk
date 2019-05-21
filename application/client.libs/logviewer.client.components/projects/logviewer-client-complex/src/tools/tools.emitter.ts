type TEmitterHandlers = Array<(...args: any[]) => void>;
type TEmitterSignature = symbol | string;

export default class Emitter {

    private handlers: Map<TEmitterSignature, TEmitterHandlers> = new Map();

    public subscribe(signature: any, handler: (...args: any[]) => void): boolean {
        signature = this.__getSymbolSignature(signature);
        if (typeof handler !== 'function') {
            throw new Error(`Handler of event should be a function.`);
        }
        let handlers = this.handlers.get(signature);
        if (!(handlers instanceof Array)) {
            handlers = [];
        }
        handlers.push(handler);
        this.handlers.set(signature, handlers);
        return true;
    }

    public unsubscribe(signature: any, handler: (...args: any[]) => void): boolean {
        signature = this.__getSymbolSignature(signature);
        const handlers = this.handlers.get(signature);
        if (!(handlers instanceof Array)) {
            return false;
        }
        this.handlers.set(signature, handlers.filter((storedHandler) => {
            return storedHandler !== handler;
        }));
        return true;
    }

    public unsubscribeAll(signature?: any) {
        if (signature === undefined) {
            this.handlers.clear();
            return;
        }
        signature = this.__getSymbolSignature(signature);
        this.handlers.delete(signature);
    }

    public emit(signature: any, ...args: any[]) {
        signature = this.__getSymbolSignature(signature);
        const handlers = this.handlers.get(signature);
        if (!(handlers instanceof Array)) {
            return false;
        }
        handlers.forEach((handler: (...args: any[]) => void) => {
            handler(...args);
        });
    }

    public listeners(signature: any) {
        signature = this.__getSymbolSignature(signature);
        const handlers = this.handlers.get(signature);
        return handlers instanceof Array ? this.handlers.get(signature) : [];
    }

    public clear() {
        this.handlers.clear();
    }

    private __getSymbolSignature(signature: any): TEmitterSignature {
        if (typeof signature === 'symbol') {
            return signature;
        } else if (typeof signature === 'string') {
            return signature;
        } else if (typeof signature === 'function') {
            return signature.name;
        } else {
            throw new Error(`Emitter support type of signature: symbol or string only.`);
        }
    }

}

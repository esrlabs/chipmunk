export enum EElementSignature {
    checkbox = 'checkbox',
    string = 'string',
    number = 'number',
}

export function getElementType(el: any): EElementSignature | undefined {
    if (typeof el !== 'object' || el === null) {
        return undefined;
    }
    return typeof el.signature === 'string' ? el.signature : undefined;
}

export function getElement(signature: string | undefined, params: any): ElementRefs | undefined {
    if (typeof signature !== 'string') {
        return;
    }
    const references = {
        [EElementSignature.checkbox]: ElementCheckboxRef,
        [EElementSignature.string]: ElementInputStringRef,
        [EElementSignature.number]: ElementInputNumberRef,
    };
    if ((references as any)[signature] === undefined) {
        return undefined;
    }
    try {
        return new (references as any)[signature](params);
    } catch (e) {
        return undefined;
    }
}

export class Element<T> {

    private _value: T | undefined;

    public set(value: T) {
        this._value = value;
    }

    public get(): T | undefined {
        return this._value;
    }

}

export interface IElement {

    getParams(): any;

}

export class ElementCheckboxRef implements IElement {

    public static readonly signature: EElementSignature = EElementSignature.checkbox;
    public readonly signature: EElementSignature = ElementCheckboxRef.signature;

    public getParams() {
        return undefined;
    }

}

interface IElementInputStringRef {
    placeholder: string;
}

export class ElementInputStringRef implements IElement {

    public static readonly signature: EElementSignature = EElementSignature.string;
    public readonly signature: EElementSignature = ElementInputStringRef.signature;

    public placeholder: string;

    constructor(params: IElementInputStringRef) {
        this.placeholder = params.placeholder;
    }

    public getParams(): IElementInputStringRef {
        return {
            placeholder: this.placeholder,
        }
    }

}

interface IElementInputNumberRef {
    placeholder: string;
    min: number;
    max: number;
}

export class ElementInputNumberRef implements IElement {

    public static readonly signature: EElementSignature = EElementSignature.number;
    public readonly signature: EElementSignature = ElementInputNumberRef.signature;

    public placeholder: string;
    public min: number;
    public max: number;

    constructor(params: IElementInputNumberRef) {
        this.placeholder = params.placeholder;
        this.min = params.min;
        this.max = params.max;
    }

    public getParams(): IElementInputNumberRef {
        return {
            placeholder: this.placeholder,
            min: this.min,
            max: this.max,
        }
    }

}

export type ElementRefs = ElementCheckboxRef | ElementInputNumberRef | ElementInputStringRef;
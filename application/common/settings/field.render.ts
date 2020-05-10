
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

export class Element<T> {

    private _value: T | undefined;

    public set(value: T) {
        this._value = value;
    }

    public get(): T | undefined {
        return this._value;
    }

}

export class ElementCheckboxRef {

    public static readonly signature: EElementSignature = EElementSignature.checkbox;
    public readonly signature: EElementSignature = ElementCheckboxRef.signature;

}

interface IElementInputStringRef {
    placeholder: string;
    label: string;
}

export class ElementInputStringRef {

    public static readonly signature: EElementSignature = EElementSignature.string;
    public readonly signature: EElementSignature = ElementInputStringRef.signature;

    public placeholder: string;
    public label: string;

    constructor(params: IElementInputStringRef) {
        this.placeholder = params.placeholder;
        this.label = params.label;
    }

}

interface IElementInputNumberRef {
    placeholder: string;
    label: string;
    min: number;
    max: number;
}

export class ElementInputNumberRef {

    public static readonly signature: EElementSignature = EElementSignature.number;
    public readonly signature: EElementSignature = ElementInputNumberRef.signature;

    public placeholder: string;
    public label: string;
    public min: number;
    public max: number;

    constructor(params: IElementInputNumberRef) {
        this.placeholder = params.placeholder;
        this.label = params.label;
        this.min = params.min;
        this.max = params.max;
    }
}

export type ElementRefs = ElementCheckboxRef | ElementInputNumberRef | ElementInputStringRef;
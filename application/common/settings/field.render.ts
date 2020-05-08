export enum EElementSignature {
    checkbox = 'checkbox',
    string = 'string',
    number = 'number',
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

export class ElementCheckbox extends Element<boolean> {

    public static readonly signature: EElementSignature = EElementSignature.checkbox;
    public readonly signature: EElementSignature = ElementCheckbox.signature;

}

export abstract class ElementInputString extends Element<string> {

    public static readonly signature: EElementSignature = EElementSignature.string;
    public readonly signature: EElementSignature = ElementInputString.signature;

    public abstract getPlaceholder(): string;
    public abstract getLabel(): string;
    public abstract getValidationError(): string;

}

export abstract class ElementInputNumber extends Element<number> {

    public static readonly signature: EElementSignature = EElementSignature.number;
    public readonly signature: EElementSignature = ElementInputNumber.signature;

    public abstract getPlaceholder(): string;
    public abstract getLabel(): string;
    public abstract getValidationError(): string;
    public abstract min(): number;
    public abstract max(): number;

}
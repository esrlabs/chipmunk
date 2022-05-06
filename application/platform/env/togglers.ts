import { unique } from './sequence';

export type THandler = (...args: any[]) => any;

export class Once {
    private _toggle: THandler | undefined;
    private _name: string;
    private _uuid: string;

    constructor(name: string, toggle: THandler, uuid?: string) {
        if (typeof toggle !== 'function') {
            throw new Error(`Should be provided toggle function.`);
        }
        this._toggle = toggle;
        this._name = name;
        this._uuid = uuid === undefined ? unique() : uuid;
    }

    public getName(): string {
        return this._name;
    }

    public getUuid(): string {
        return this._uuid;
    }

    public emit(): void {
        if (this._toggle === undefined) {
            throw new Error(`Can toggle state only once`);
        }
        this._toggle();
        this._toggle = undefined;
    }

    public emitted(): boolean {
        return this._toggle === undefined;
    }

    public destroy(): void {
        this.emit();
    }
}

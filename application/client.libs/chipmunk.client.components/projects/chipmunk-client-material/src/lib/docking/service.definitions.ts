import * as Tools from '../../tools/index';
import { IComponentDesc } from '../dynamic/component';

export interface IDockTitleContent {
    id: string | number;
    component: IComponentDesc;
}

export enum EDockPosition {
    vertical = 'vertical',
    horizontal = 'horizontal'
}
export interface IDockPosition {
    position: EDockPosition;
    weight: number;
}

export interface IContainer {
    id?: string;
    dock: IDock | IContainer;
    child?: IContainer;
    position?: IDockPosition;
}

export interface IDock {
    id?: string;
    caption: string;
    closable?: boolean;
    component?: IComponentDesc;
}

export interface IDockContainer {
    id?: string;
    docks: IDock[];
}

export interface IPositionSubject {
    position: IDockPosition;
    id: string;
}

export interface IDockDrop {
    host: string;
    target: string;
    parking: string;
}

export enum EDirection {
    vertical = 'vertical',
    horizontal = 'horizontal'
}

export interface IPosition {
    direction: EDirection;
    weight: number;
}

export class Dock {

    private _id: string = Tools.guid();
    private _caption: string;
    private _component: IComponentDesc | undefined;
    private _closable: boolean;

    constructor( params: IDock) {
        this._id = params.id !== void 0 ? params.id : this._id;
        this._caption = params.caption !== void 0 ? params.caption : this._caption;
        this._component = params.component !== void 0 ? params.component : undefined;
        this._closable = typeof params.closable === 'boolean' ? params.closable : true;
    }

    public isContainer(): boolean {
        return false;
    }

    public isDock(): boolean {
        return true;
    }

    public get id(): string {
        return this._id;
    }

    public get caption(): string {
        return this._caption;
    }

    public get component(): IComponentDesc | undefined {
        return this._component;
    }

    public get closable(): boolean {
        return this._closable;
    }

    public set caption(value: string) {
        this._caption = value;
    }

    public set component(value: IComponentDesc | undefined) {
        this._component = value;
    }

    public set closable(value: boolean) {
        this._closable = value;
    }

}

export class Container {

    private _id: string = Tools.guid();
    private _a: Dock | Container;
    private _b: Dock | Container;
    private _position: IPosition;

    constructor( params: { id?: string, a?: Dock | Container, b?: Dock | Container, position?: IPosition}) {
        this._id = params.id !== void 0 ? params.id : this._id;
        this._a = params.a !== void 0 ? params.a : this._a;
        this._b = params.b !== void 0 ? params.b : this._b;
        this._position = params.position !== void 0 ? params.position : this._setAlign(Math.random() > 0.5 ? EDirection.horizontal : EDirection.vertical, 0.5);
    }

    public get id(): string {
        return this._id;
    }

    public get position(): IPosition {
        return this._position;
    }

    public get a(): Dock | Container {
        return this._a;
    }

    public set a(value: Dock | Container) {
        if (!(value instanceof Dock) && !(value instanceof Container)) {
            return;
        }
        this._a = value;
    }

    public get b(): Dock | Container {
        return this._b;
    }

    public set b(value: Dock | Container) {
        if (!(value instanceof Dock) && !(value instanceof Container)) {
            return;
        }
        this._b = value;
    }


    public isContainer(): boolean {
        return true;
    }

    public isDock(): boolean {
        return false;
    }

    public hasBoth(): boolean {
        return this._a !== undefined && this._b !== undefined;
    }

    public getDefinedEntity(): Dock | Container | undefined {
        return this._a !== undefined ? this._a : this._b;
    }

    public optimize() {
        ['_a', '_b'].forEach((key: string) => {
            if (this[key] instanceof Container && !this[key].hasBoth() && !this[key].isEmpty()) {
                this[key] = this[key].getDefinedEntity();
            } else if (this[key] instanceof Container && this[key].isEmpty()) {
                this[key] = undefined;
            }
            if (this[key] instanceof Container) {
                this[key].optimize();
            }
        });
    }

    public isEmpty(): boolean {
        return this._a === undefined && this._b === undefined;
    }

    public drop(key: string) {
        switch (key) {
            case 'a':
                this._a = undefined;
                break;
            case 'b':
                this._b = undefined;
                break;
        }
    }

    public toVerticalAlign() {
        this._setAlign(EDirection.vertical, this._position.weight);
    }

    public toHorizontalAlign() {
        this._setAlign(EDirection.horizontal, this._position.weight);
    }

    private _setAlign(direction: EDirection, weight: number): IPosition {
        if (this._a !== void 0 && this._b !== void 0) {
            this._position = { weight: weight, direction: direction };
        } else {
            this._position = { weight: 1, direction: direction };
        }
        return this._position;
    }

}


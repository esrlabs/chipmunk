import { Observable, Subject, Subscription } from 'rxjs';
import { ISearchExpression, ISearchExpressionFlags } from '../interfaces/interface.ipc';
import { getMarkerRegExp, getSearchRegExp } from '../../../../../common/functionlity/functions.search.requests';
import {  getContrastColor, scheme_color_accent } from '../theme/colors';

import * as Toolkit from 'chipmunk.client.toolkit';
import * as ColorScheme from '../theme/colors';

export { ISearchExpressionFlags as IFlags };

export interface IDesc {
    request: string;
    color: string;
    background: string;
    active: boolean;
    flags: ISearchExpressionFlags;
    guid: string;
}

export interface IDescOptional {
    request: string;
    flags: ISearchExpressionFlags;
    guid?: string;
    color?: string;
    background?: string;
    active?: boolean;
}

export interface IDescUpdating {
    request?: string;
    flags?: ISearchExpressionFlags;
    color?: string;
    background?: string;
    active?: boolean;
}

export class FilterRequest {

    private _flags: ISearchExpressionFlags;
    private _request: string;
    private _color: string;
    private _background: string;
    private _active: boolean;
    private _hash: string;
    private _guid: string;
    private _regexp: RegExp;
    private _subscriptions: {
        updated: Subscription[],
        changed: Subscription[],
    } = {
        updated: [],
        changed: []
    };
    private _subjects: {
        updated: Subject<FilterRequest>,
        changed: Subject<FilterRequest>,
    } = {
        updated: new Subject<FilterRequest>(),
        changed: new Subject<FilterRequest>(),
    };

    static isValid(request: string): boolean {
        if (!Toolkit.regTools.isRegStrValid(request)) {
            return false;
        }
        return true;
    }

    constructor(desc: IDescOptional) {
        if (desc.flags.regexp && !Toolkit.regTools.isRegStrValid(desc.request)) {
            throw new Error(`Not valid RegExp: ${desc.request}`);
        }
        this._request = desc.request;
        this._flags = Object.assign({}, desc.flags);
        this._setRegExps();
        if (typeof desc.guid === 'string') {
            this._guid = desc.guid;
        } else {
            this._guid = Toolkit.guid();
        }
        if (typeof desc.color === 'string') {
            this._color = desc.color;
        } else if (typeof desc.background === 'string') {
            this._color = getContrastColor(desc.background, true);
        } else {
            this._color = getContrastColor(scheme_color_accent, true);
        }
        if (typeof desc.background === 'string') {
            this._background = desc.background;
        } else {
            this._background = scheme_color_accent;
        }
        if (typeof desc.active === 'boolean') {
            this._active = desc.active;
        } else {
            this._active = true;
        }
    }

    public destroy() {
        this._regexp = undefined;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].forEach((subscription: Subscription) => {
                subscription.unsubscribe();
            });
        });
    }

    public onUpdated(handler: (request: FilterRequest) => void): void {
       this._subscriptions.updated.push(this._subjects.updated.asObservable().subscribe(handler));
    }

    public onChanged(handler: (request: FilterRequest) => void): void {
        this._subscriptions.changed.push(this._subjects.changed.asObservable().subscribe(handler));
    }

    public getColor(): string {
        return this._color;
    }

    public getBackground(): string {
        return this._background;
    }

    public asDesc(): IDesc {
        return {
            guid: this._guid,
            request: this._request,
            color: this._color,
            background: this._background,
            active: this._active,
            flags: Object.assign({}, this._flags),
        };
    }

    public asIPC(): ISearchExpression {
        return {
            request: this._request,
            flags: Object.assign({}, this._flags),
        };
    }

    public asRegExp(): RegExp {
        return this._regexp;
    }

    public update(desc: IDescUpdating): boolean {
        let hasToBeEmitted: boolean = false;
        if (typeof desc.request     === 'string'    && this.setRequest(desc.request, true)  ) { hasToBeEmitted = true; }
        if (typeof desc.flags       === 'string'    && this.setFlags(desc.flags, true)      ) { hasToBeEmitted = true; }
        if (typeof desc.active      === 'boolean'   && this.setState(desc.active, true)     ) { hasToBeEmitted = true; }
        if (typeof desc.color       === 'string') { this.setColor(desc.color); }
        if (typeof desc.background  === 'string') { this.setBackground(desc.background); }
        if (hasToBeEmitted) {
            this._subjects.updated.next(this);
        }
        return hasToBeEmitted;
    }

    public setColor(color: string) {
        this._color = color;
        this._subjects.changed.next(this);
    }

    public setBackground(background: string) {
        this._background = background;
        this._subjects.changed.next(this);
    }

    public setState(active: boolean, silence: boolean = false): boolean {
        const prevState: boolean = this._active;
        this._active = active;
        this._subjects.changed.next(this);
        return this._isUpdated(prevState !== this._active, silence);
    }

    public setFlags(flags: ISearchExpressionFlags, silence: boolean = false): boolean {
        const hash: string = this._hash;
        this._flags = Object.assign({}, flags);
        this._setRegExps();
        this._subjects.changed.next(this);
        return this._isUpdated(hash, silence);
    }

    public setRequest(request: string, silence: boolean = false): boolean {
        const hash: string = this._hash;
        this._request = request;
        this._setRegExps();
        this._subjects.changed.next(this);
        return this._isUpdated(hash, silence);
    }

    public getHash(): string {
        return this._hash;
    }

    public getGUID(): string {
        return this._guid;
    }

    public getState(): boolean {
        return this._active;
    }

    private _isUpdated(prev: string | boolean, silence: boolean = false): boolean {
        if (prev === true || this._hash !== prev) {
            if (!silence) {
                this._subjects.updated.next(this);
            }
            return true;
        } else {
            return false;
        }
    }

    private _setRegExps() {
        this._regexp = getMarkerRegExp(this._request, this._flags);
        this._hash = this._regexp.source + this._regexp.flags;
    }

}

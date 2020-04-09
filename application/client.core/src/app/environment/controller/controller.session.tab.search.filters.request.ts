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

export interface IFilterUpdateEvent {
    filter: FilterRequest;
    updated: {
        request: boolean;
        state: boolean;
        colors: boolean;
    };
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
    } = {
        updated: [],
    };
    private _subjects: {
        updated: Subject<IFilterUpdateEvent>,
    } = {
        updated: new Subject<IFilterUpdateEvent>(),
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

    public onUpdated(handler: (event: IFilterUpdateEvent) => void): void {
       this._subscriptions.updated.push(this._subjects.updated.asObservable().subscribe(handler));
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
        const event: IFilterUpdateEvent = {
            updated: {
                request: false,
                colors: false,
                state: false,
            },
            filter: this,
        };
        if (typeof desc.request     === 'string'    && this.setRequest(desc.request, true)  ) { event.updated.request = true; }
        if (typeof desc.flags       === 'string'    && this.setFlags(desc.flags, true)      ) { event.updated.request = true; }
        if (typeof desc.active      === 'boolean'   && this.setState(desc.active, true)     ) { event.updated.state = true; }
        if (typeof desc.color       === 'string'    && this.setColor(desc.color)            ) { event.updated.colors = true;  }
        if (typeof desc.background  === 'string'    && this.setBackground(desc.background)  ) { event.updated.colors = true;  }
        const hasToBeEmitted: boolean = event.updated.request || event.updated.state || event.updated.colors;
        if (hasToBeEmitted) {
            this._subjects.updated.next(event);
        }
        return hasToBeEmitted;
    }

    public setColor(color: string, silence: boolean = false): boolean {
        if (this._color === color) {
            return false;
        }
        this._color = color;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: false,
                    colors: true,
                    state: false,
                },
                filter: this,
            });
        }
        return true;
    }

    public setBackground(background: string, silence: boolean = false): boolean {
        if (this._background === background) {
            return false;
        }
        this._background = background;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: false,
                    colors: true,
                    state: false,
                },
                filter: this,
            });
        }
        return true;
    }

    public setState(active: boolean, silence: boolean = false): boolean {
        if (this._active === active) {
            return false;
        }
        this._active = active;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: false,
                    colors: false,
                    state: true,
                },
                filter: this,
            });
        }
        return true;
    }

    public setFlags(flags: ISearchExpressionFlags, silence: boolean = false): boolean {
        this._flags = Object.assign({}, flags);
        if (!this._setRegExps()) {
            return false;
        }
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: true,
                    colors: false,
                    state: false,
                },
                filter: this,
            });
        }
        return true;
    }

    public setRequest(request: string, silence: boolean = false): boolean {
        this._request = request;
        if (!this._setRegExps()) {
            return false;
        }
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: true,
                    colors: false,
                    state: false,
                },
                filter: this,
            });
        }
        return true;
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

    private _setRegExps(): boolean {
        const prev: string = this._hash;
        this._regexp = getMarkerRegExp(this._request, this._flags);
        this._hash = this._regexp.source + this._regexp.flags;
        return prev !== this._hash;
    }

}

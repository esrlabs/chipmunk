import { Observable, Subject, Subscription } from 'rxjs';
import { CommonInterfaces } from '../../../../../../interfaces/interface.common';
import { getMarkerRegExp, getSearchRegExp } from '../../../../../../../../../../common/functionlity/functions.search.requests';
import { getContrastColor, scheme_color_accent } from '../../../../../../theme/colors';
import { IDisabledEntitySupport, EEntityTypeRef } from '../disabled/controller.session.tab.search.disabled.support';
import { Session } from '../../../../session';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IDesc {
    filter: string;
    color: string;
    background: string;
    active: boolean;
    flags: CommonInterfaces.API.IFilterFlags;
    guid: string;
}

export interface IDescOptional {
    filter: string;
    flags: CommonInterfaces.API.IFilterFlags;
    guid?: string;
    color?: string;
    background?: string;
    active?: boolean;
    expression?: CommonInterfaces.API.IFilter;
}

export interface IDescUpdating {
    filter?: string;
    flags?: CommonInterfaces.API.IFilterFlags;
    color?: string;
    background?: string;
    active?: boolean;
}

export interface IFilterUpdateEvent {
    filter: FilterRequest;
    updated: {
        filter: boolean;
        state: boolean;
        colors: boolean;
    };
}

export class FilterRequest implements IDisabledEntitySupport {

    private _flags: CommonInterfaces.API.IFilterFlags;
    private _filter: string;
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

    static isValid(filter: string): boolean {
        if (!Toolkit.regTools.isRegStrValid(filter)) {
            return false;
        }
        return true;
    }

    constructor(desc: IDescOptional) {
        if (typeof desc.expression === 'object' && desc.flags === undefined) {
            desc.flags = desc.expression.flags;
        }
        if (typeof desc.expression === 'object' && desc.filter === undefined) {
            desc.filter = desc.expression.filter;
        }
        if (desc.flags.reg && !Toolkit.regTools.isRegStrValid(desc.filter)) {
            throw new Error(`Not valid RegExp: ${desc.filter}`);
        }
        this._filter = desc.filter;
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
            filter: this._filter,
            color: this._color,
            background: this._background,
            active: this._active,
            flags: Object.assign({}, this._flags),
        };
    }

    public asIPC(): CommonInterfaces.API.IFilter {
        return {
            filter: this._filter,
            flags: Object.assign({}, this._flags),
        };
    }

    public asRegExp(): RegExp {
        return this._regexp;
    }

    public update(desc: IDescUpdating): boolean {
        const event: IFilterUpdateEvent = {
            updated: {
                filter: false,
                colors: false,
                state: false,
            },
            filter: this,
        };
        if (typeof desc.filter      === 'string'    && this.setRequest(desc.filter, true)   ) { event.updated.filter = true; }
        if (typeof desc.flags       === 'string'    && this.setFlags(desc.flags, true)      ) { event.updated.filter = true; }
        if (typeof desc.active      === 'boolean'   && this.setState(desc.active, true)     ) { event.updated.state = true; }
        if (typeof desc.color       === 'string'    && this.setColor(desc.color)            ) { event.updated.colors = true;  }
        if (typeof desc.background  === 'string'    && this.setBackground(desc.background)  ) { event.updated.colors = true;  }
        const hasToBeEmitted: boolean = event.updated.filter || event.updated.state || event.updated.colors;
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
                    filter: false,
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
                    filter: false,
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
                    filter: false,
                    colors: false,
                    state: true,
                },
                filter: this,
            });
        }
        return true;
    }

    public setFlags(flags: CommonInterfaces.API.IFilterFlags, silence: boolean = false): boolean {
        this._flags = Object.assign({}, flags);
        if (!this._setRegExps()) {
            return false;
        }
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    filter: true,
                    colors: false,
                    state: false,
                },
                filter: this,
            });
        }
        return true;
    }

    public setRequest(filter: string, silence: boolean = false): boolean {
        this._filter = filter;
        if (!this._setRegExps()) {
            return false;
        }
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    filter: true,
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

    public getDisplayName(): string {
        return this._filter;
    }

    public getIcon(): string {
        return 'search';
    }

    public getTypeRef(): EEntityTypeRef {
        return EEntityTypeRef.filter;
    }

    public remove(session: Session) {
        session.getSessionSearch().getFiltersAPI().getStorage().remove(this);
    }

    public restore(session: Session) {
        session.getSessionSearch().getFiltersAPI().getStorage().add(this);
    }

    public matches(session: Session) {
        session.getSessionSearch().search(new FilterRequest({
            filter: this.asDesc().filter,
            flags: {
                cases: false,
                word: false,
                reg: true,
            }
        }));
    }

    private _setRegExps(): boolean {
        const prev: string = this._hash;
        this._regexp = getMarkerRegExp(this._filter, this._flags);
        this._hash = this._regexp.source + this._regexp.flags;
        return prev !== this._hash;
    }

}

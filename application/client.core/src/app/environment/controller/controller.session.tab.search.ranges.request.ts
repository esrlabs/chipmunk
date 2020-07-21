import { Observable, Subject, Subscription, from } from 'rxjs';
import { ISearchExpression, ISearchExpressionFlags } from '../interfaces/interface.ipc';
import { getMarkerRegExp, getSearchRegExp } from '../../../../../common/functionlity/functions.search.requests';
import {  getContrastColor, scheme_color_accent } from '../theme/colors';
import { FilterRequest } from './controller.session.tab.search.filters.request';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IDesc {
    guid: string;
    start: FilterRequest;
    end: FilterRequest;
    active: boolean;
    color: string;
}

export interface IDescOptional {
    guid?: string;
    start: FilterRequest;
    end: FilterRequest;
    active?: boolean;
    color?: string;
}

export interface IDescUpdating {
    start?: FilterRequest;
    end?: FilterRequest;
    active?: boolean;
    color?: string;
}

export interface IRangeUpdateEvent {
    range: RangeRequest;
    updated: {
        borders: boolean;
        state: boolean;
        color: boolean;
    };
}

export class RangeRequest {

    private _start: FilterRequest;
    private _end: FilterRequest;
    private _color: string;
    private _active: boolean;
    private _guid: string;
    private _subscriptions: {
        updated: Subscription[],
    } = {
        updated: [],
    };
    private _subjects: {
        updated: Subject<IRangeUpdateEvent>,
    } = {
        updated: new Subject<IRangeUpdateEvent>(),
    };

    constructor(desc: IDescOptional) {
        if (!(desc.start instanceof FilterRequest) || !(desc.end instanceof FilterRequest)) {
            throw new Error(`To create range should be defined 2 FilterRequest as start and end of range`);
        }
        this._start = desc.start;
        this._end = desc.end;
        if (typeof desc.guid === 'string') {
            this._guid = desc.guid;
        } else {
            this._guid = `${this._start.getGUID()}:${this._end.getGUID()}`;
        }
        if (typeof desc.color === 'string') {
            this._color = desc.color;
        } else {
            this._color = getContrastColor(scheme_color_accent, true);
        }
        if (typeof desc.active === 'boolean') {
            this._active = desc.active;
        } else {
            this._active = true;
        }
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].forEach((subscription: Subscription) => {
                subscription.unsubscribe();
            });
        });
    }

    public onUpdated(handler: (event: IRangeUpdateEvent) => void): void {
       this._subscriptions.updated.push(this._subjects.updated.asObservable().subscribe(handler));
    }

    public getColor(): string {
        return this._color;
    }

    public asDesc(): IDesc {
        return {
            guid: this.getGUID(),
            start: this._start,
            end: this._end,
            active: this.getState(),
            color: this.getColor(),
        };
    }

    public update(desc: IDescUpdating): boolean {
        const event: IRangeUpdateEvent = {
            updated: {
                borders: false,
                color: false,
                state: false,
            },
            range: this,
        };
        if (desc.start instanceof FilterRequest                                             ) { event.updated.borders = true; }
        if (desc.end instanceof FilterRequest                                               ) { event.updated.borders = true; }
        if (typeof desc.active      === 'boolean'   && this.setState(desc.active, true)     ) { event.updated.state = true; }
        if (typeof desc.color       === 'string'    && this.setColor(desc.color)            ) { event.updated.color = true;  }
        const hasToBeEmitted: boolean = event.updated.borders || event.updated.state || event.updated.color;
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
                    borders: false,
                    color: true,
                    state: false,
                },
                range: this,
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
                    borders: false,
                    color: false,
                    state: true,
                },
                range: this,
            });
        }
        return true;
    }


    public setStart(filter: FilterRequest, silence: boolean = false): boolean {
        return this._setBorder('start', filter, silence);
    }

    public setEnd(filter: FilterRequest, silence: boolean = false): boolean {
        return this._setBorder('end', filter, silence);
    }

    public getGUID(): string {
        return this._guid;
    }

    public getState(): boolean {
        return this._active;
    }

    private _setBorder(dest: 'start' | 'end', filter: FilterRequest, silence: boolean = false): boolean {
        if (dest === 'start') {
            this._start = filter;
        } else {
            this._end = filter;
        }
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    borders: true,
                    color: false,
                    state: false,
                },
                range: this,
            });
        }
        return true;
    }

}

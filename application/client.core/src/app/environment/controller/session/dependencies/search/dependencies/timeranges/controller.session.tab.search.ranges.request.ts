import { Subject, Subscription } from 'rxjs';
import { getContrastColor, scheme_color_accent } from '../../../../../../theme/colors';
import {
    FilterRequest,
    IDesc as IFilterDesc,
} from '../filters/controller.session.tab.search.filters.request';
import {
    IDisabledEntitySupport,
    EEntityTypeRef,
} from '../disabled/controller.session.tab.search.disabled.support';
import { Session } from '../../../../session';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IDesc {
    guid: string;
    alias: string;
    points: Array<FilterRequest | IFilterDesc>;
    color: string;
    strict: boolean;
}

export interface IDescOptional {
    guid?: string;
    alias?: string;
    points: Array<FilterRequest | IFilterDesc>;
    color?: string;
    strict?: boolean;
}

export interface IDescUpdating {
    alias?: string;
    points?: Array<FilterRequest | IFilterDesc>;
    color?: string;
    strict?: boolean;
}

export interface IRangeUpdateEvent {
    range: RangeRequest;
    updated: {
        points: boolean;
        color: boolean;
        alias: boolean;
        strict: boolean;
    };
}

export class RangeRequest implements IDisabledEntitySupport {
    private _points: FilterRequest[];
    private _color: string;
    private _alias: string;
    private _strict: boolean;
    private _guid: string;
    private _subscriptions: {
        [key: string]: Subscription[];
    } = {
        updated: [],
    };
    private _subjects: {
        updated: Subject<IRangeUpdateEvent>;
    } = {
        updated: new Subject<IRangeUpdateEvent>(),
    };

    public static isValidAlias(alias: string): boolean {
        if (typeof alias !== 'string' || alias.trim() === '') {
            return false;
        }
        return true;
    }

    constructor(desc: IDescOptional) {
        if (!(desc.points instanceof Array) || desc.points.length < 2) {
            throw new Error(
                `To create range should be defined at least 2 FilterRequest as start and end of range`,
            );
        }
        this._points = desc.points.map((filter: FilterRequest | IFilterDesc) => {
            return filter instanceof FilterRequest ? filter : new FilterRequest(filter);
        });
        if (typeof desc.guid === 'string') {
            this._guid = desc.guid;
        } else {
            this._guid = Toolkit.hash(this._points.map((_) => _.getHash()).join(''));
        }
        if (typeof desc.color === 'string') {
            this._color = desc.color;
        } else {
            this._color = getContrastColor(scheme_color_accent, true);
        }
        if (typeof desc.strict === 'boolean') {
            this._strict = desc.strict;
        } else {
            this._strict = true;
        }
        if (typeof desc.alias !== 'string' || desc.alias.trim() === '') {
            this._alias = `Time range`;
        } else {
            this._alias = desc.alias;
        }
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions[key] as Subscription[]).forEach((subscription: Subscription) => {
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

    public getAlias(): string {
        return this._alias;
    }

    public getStrictState(): boolean {
        return this._strict;
    }

    public asDesc(): IDesc {
        return {
            alias: this.getAlias(),
            guid: this.getGUID(),
            points: this.getPoints().map((filter: FilterRequest) => {
                return filter.asDesc();
            }),
            color: this.getColor(),
            strict: this.getStrictState(),
        };
    }

    public update(desc: IDescUpdating): boolean {
        const event: IRangeUpdateEvent = {
            updated: {
                points: false,
                color: false,
                alias: false,
                strict: false,
            },
            range: this,
        };
        if (desc.points instanceof Array && desc.points.length >= 2) {
            event.updated.points = true;
        }
        if (typeof desc.strict === 'boolean' && this.setStrictState(desc.strict, true)) {
            event.updated.strict = true;
        }
        if (typeof desc.color === 'string' && this.setColor(desc.color)) {
            event.updated.color = true;
        }
        if (typeof desc.alias === 'string' && this.setAlias(desc.alias)) {
            event.updated.alias = true;
        }
        const hasToBeEmitted: boolean =
            event.updated.points || event.updated.color || event.updated.strict;
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
                    points: false,
                    color: true,
                    alias: false,
                    strict: false,
                },
                range: this,
            });
        }
        return true;
    }

    public setStrictState(strict: boolean, silence: boolean = false): boolean {
        if (this._strict === strict) {
            return false;
        }
        this._strict = strict;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    points: false,
                    color: false,
                    alias: false,
                    strict: true,
                },
                range: this,
            });
        }
        return true;
    }

    public setAlias(alias: string, silence: boolean = false): boolean {
        if (this._alias === alias) {
            return false;
        }
        this._alias = alias;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    points: false,
                    color: false,
                    alias: true,
                    strict: false,
                },
                range: this,
            });
        }
        return true;
    }

    public getPoints(): FilterRequest[] {
        return this._points;
    }

    public setPoint(filter: FilterRequest, index: number, silence: boolean = false): boolean {
        if (this._points[index] === undefined) {
            return false;
        }
        this._points[index] = filter;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    points: true,
                    color: false,
                    alias: false,
                    strict: false,
                },
                range: this,
            });
        }
        return true;
    }

    public getGUID(): string {
        return this._guid;
    }

    public getDisplayName(): string {
        return this._alias;
    }

    public getIcon(): string {
        return 'alarm';
    }

    public getTypeRef(): EEntityTypeRef {
        return EEntityTypeRef.range;
    }

    public remove(session: Session) {
        session.getSessionSearch().getRangesAPI().getStorage().remove(this);
    }

    public restore(session: Session) {
        session.getSessionSearch().getRangesAPI().getStorage().add(this);
    }
}

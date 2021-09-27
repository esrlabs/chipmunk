import { Subject, Subscription } from 'rxjs';
import {
    ISearchExpression,
    ISearchExpressionFlags,
} from '../../../../../../interfaces/interface.ipc';
import { getMarkerRegExp } from '../../../../../../../../../../common/functionlity/functions.search.requests';
import {
    AChart,
    IOptionsObj,
    EChartType,
} from '../../../../../../components/views/chart/charts/charts';
import { isObjSame } from '../../../../../helpers/obj';
import {
    IDisabledEntitySupport,
    EEntityTypeRef,
} from '../disabled/controller.session.tab.search.disabled.support';
import { FilterRequest } from '../filters/controller.session.tab.search.filters.request';
import { Session } from '../../../../session';

import ChartControllers from '../../../../../../components/views/chart/charts/charts';

import * as Toolkit from 'chipmunk.client.toolkit';
import * as ColorScheme from '../../../../../../theme/colors';

export { ISearchExpressionFlags as IFlags };

export interface IDesc {
    request: string;
    color: string;
    active: boolean;
    flags: ISearchExpressionFlags;
    options: IOptionsObj;
    type: EChartType;
    guid: string;
}

export interface IDescOptional {
    request: string;
    type: EChartType;
    options?: IOptionsObj;
    guid?: string;
    color?: string;
    active?: boolean;
}

export interface IDescUpdating {
    request?: string;
    flags?: ISearchExpressionFlags;
    color?: string;
    active?: boolean;
    options?: IOptionsObj;
    type?: EChartType;
}

export interface IChartUpdateEvent {
    filter: ChartRequest;
    updated: {
        request: boolean;
        state: boolean;
        options: boolean;
        type: boolean;
    };
}

export class ChartRequest implements IDisabledEntitySupport {
    private _flags: ISearchExpressionFlags;
    private _request: string;
    private _color: string;
    private _active: boolean;
    private _hash!: string;
    private _guid: string;
    private _options: IOptionsObj;
    private _type: EChartType;
    private _regexp!: RegExp;
    private _subscriptions: {
        [key: string]: Subscription[];
    } = {
        updated: [],
    };
    private _subjects: {
        updated: Subject<IChartUpdateEvent>;
    } = {
        updated: new Subject<IChartUpdateEvent>(),
    };

    static isValid(request: string): boolean {
        if (!Toolkit.regTools.isRegStrValid(request)) {
            return false;
        }
        if (request.search(/\([^\(]*\)/gi) === -1) {
            return false;
        }
        return true;
    }

    constructor(desc: IDescOptional) {
        // Check regexp
        if (!ChartRequest.isValid(desc.request)) {
            throw new Error(`Not valid RegExp: ${desc.request}`);
        }
        // Check type of chart
        const controller: AChart | undefined = ChartControllers[desc.type];
        if (controller === undefined) {
            throw new Error(`Fail to find controller for chart type ${desc.type}`);
        }
        this._request = desc.request;
        this._flags = {
            regexp: true,
            casesensitive: false,
            wholeword: false,
        };
        this._setRegExps();
        if (typeof desc.guid === 'string') {
            this._guid = desc.guid;
        } else {
            this._guid = Toolkit.guid();
        }
        if (typeof desc.color === 'string') {
            this._color = desc.color;
        } else {
            this._color = ColorScheme.scheme_color_0;
        }
        if (typeof desc.active === 'boolean') {
            this._active = desc.active;
        } else {
            this._active = true;
        }
        if (typeof desc.options === 'object') {
            this._options = desc.options;
        } else {
            this._options = {};
        }
        if (typeof desc.type === 'string') {
            this._type = desc.type;
        } else {
            this._type = EChartType.smooth;
        }
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].forEach((subscription: Subscription) => {
                subscription.unsubscribe();
            });
        });
    }

    public onUpdated(handler: (event: IChartUpdateEvent) => void): void {
        this._subscriptions.updated.push(this._subjects.updated.asObservable().subscribe(handler));
    }

    public getColor(): string {
        return this._color;
    }

    public getType(): EChartType {
        return this._type;
    }

    public getOptions(): IOptionsObj {
        return Object.assign({}, this._options);
    }

    public asDesc(): IDesc {
        return {
            guid: this._guid,
            request: this._request,
            color: this._color,
            active: this._active,
            type: this._type,
            flags: Object.assign({}, this._flags),
            options: Object.assign({}, this._options),
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
        const event: IChartUpdateEvent = {
            updated: {
                request: false,
                type: false,
                state: false,
                options: false,
            },
            filter: this,
        };
        if (typeof desc.request === 'string' && this.setRequest(desc.request, true)) {
            event.updated.request = true;
        }
        if (typeof desc.flags === 'string' && this.setFlags(desc.flags, true)) {
            event.updated.request = true;
        }
        if (typeof desc.active === 'boolean' && this.setState(desc.active, true)) {
            event.updated.state = true;
        }
        if (typeof desc.options === 'object' && this.setOptions(desc.options, true)) {
            event.updated.options = true;
        }
        if (typeof desc.color === 'string' && this.setColor(desc.color, true)) {
            event.updated.options = true;
        }
        const hasToBeEmitted: boolean =
            event.updated.request || event.updated.state || event.updated.options;
        if (hasToBeEmitted) {
            this._subjects.updated.next(event);
        }
        return hasToBeEmitted;
    }

    public setColor(color: string, silence: boolean = false) {
        if (this._color === color) {
            return false;
        }
        this._color = color;
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: false,
                    options: true,
                    state: false,
                    type: false,
                },
                filter: this,
            });
        }
        return true;
    }

    public setOptions(options: IOptionsObj, silence: boolean = false) {
        if (isObjSame(this._options, options)) {
            return false;
        }
        this._options = Object.assign({}, options);
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: false,
                    type: false,
                    state: false,
                    options: true,
                },
                filter: this,
            });
        }
        return true;
    }

    public setType(type: EChartType, silence: boolean = false): boolean {
        if (this._type === type) {
            return false;
        }
        const controller: AChart | undefined = ChartControllers[type];
        if (controller === undefined) {
            throw new Error(`Fail to find controller for chart type ${type}`);
        }
        this._type = type;
        this._options = controller.getDefaultsOptions(this._options);
        if (!silence) {
            this._subjects.updated.next({
                updated: {
                    request: false,
                    type: true,
                    state: false,
                    options: false,
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
                    type: false,
                    state: true,
                    options: false,
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
                    type: false,
                    state: false,
                    options: false,
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
                    type: false,
                    state: false,
                    options: false,
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
        return this._request;
    }

    public getIcon(): string {
        return 'timeline';
    }

    public getTypeRef(): EEntityTypeRef {
        return EEntityTypeRef.chart;
    }

    public remove(session: Session) {
        session.getSessionSearch().getChartsAPI().getStorage().remove(this);
    }

    public restore(session: Session) {
        session.getSessionSearch().getChartsAPI().getStorage().add(this);
    }

    public matches(session: Session) {
        session.getSessionSearch().search(
            new FilterRequest({
                request: this.asDesc().request,
                flags: {
                    casesensitive: false,
                    wholeword: false,
                    regexp: true,
                },
            }),
        );
    }

    private _setRegExps(): boolean {
        const prev: string = this._hash;
        this._regexp = getMarkerRegExp(this._request, this._flags);
        this._hash = this._regexp.source + this._regexp.flags;
        return prev !== this._hash;
    }
}

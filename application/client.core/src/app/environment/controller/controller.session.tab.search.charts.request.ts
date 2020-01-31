import { Observable, Subject, Subscription } from 'rxjs';
import { ISearchExpression, ISearchExpressionFlags } from '../interfaces/interface.ipc';
import { getMarkerRegExp, getSearchRegExp } from '../../../../../common/functionlity/functions.search.requests';
import ChartControllers, { AChart, IOption, IOptionsObj, EOptionType, EChartType } from '../components/views/chart/charts/charts';

import * as Toolkit from 'chipmunk.client.toolkit';
import * as ColorScheme from '../theme/colors';

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

export class ChartRequest {

    static isValid(request: string): boolean {
        if (!Toolkit.regTools.isRegStrValid(request)) {
            return false;
        }
        if (request.search(/\([^\(]*\)/gi) === -1) {
            return false;
        }
        return true;
    }

    private _flags: ISearchExpressionFlags;
    private _request: string;
    private _color: string;
    private _active: boolean;
    private _hash: string;
    private _guid: string;
    private _options: IOptionsObj;
    private _type: EChartType;
    private _regexp: RegExp;
    private _subscriptions: {
        updated: Subscription[],
        changed: Subscription[],
    } = {
        updated: [],
        changed: []
    };
    private _subjects: {
        updated: Subject<ChartRequest>,
        changed: Subject<ChartRequest>,
    } = {
        updated: new Subject<ChartRequest>(),
        changed: new Subject<ChartRequest>(),
    };

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
            this._options = { };
        }
        if (typeof desc.type === 'string') {
            this._type = desc.type;
        } else {
            this._type = EChartType.stepped;
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

    public onUpdated(handler: (request: ChartRequest) => void): void {
       this._subscriptions.updated.push(this._subjects.updated.asObservable().subscribe(handler));
    }

    public onChanged(handler: (request: ChartRequest) => void): void {
        this._subscriptions.changed.push(this._subjects.changed.asObservable().subscribe(handler));
    }

    public getColor(): string {
        return this._color;
    }

    public getType(): EChartType {
        return this._type;
    }

    public getOptions(): IOptionsObj {
        return this._options;
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
        let hasToBeEmitted: boolean = false;
        if (typeof desc.request     === 'string'    && this.setRequest(desc.request, true)  ) { hasToBeEmitted = true; }
        if (typeof desc.flags       === 'string'    && this.setFlags(desc.flags, true)      ) { hasToBeEmitted = true; }
        if (typeof desc.active      === 'boolean'   && this.setState(desc.active, true)     ) { hasToBeEmitted = true; }
        if (typeof desc.options     === 'object') { this.setOptions(desc.options); }
        if (typeof desc.color       === 'string') { this.setColor(desc.color); }
        if (hasToBeEmitted) {
            this._subjects.updated.next(this);
        }
        return hasToBeEmitted;
    }

    public setColor(color: string) {
        this._color = color;
        this._subjects.changed.next(this);
    }

    public setOptions(options: IOptionsObj) {
        this._options = Object.assign({}, options);
        this._subjects.changed.next(this);
    }

    public setType(type: EChartType, silence: boolean = false): boolean {
        const controller: AChart | undefined = ChartControllers[type];
        if (controller === undefined) {
            throw new Error(`Fail to find controller for chart type ${type}`);
        }
        this._type = type;
        this._options = controller.getDefaultsOptions(this._options);
        this._subjects.changed.next(this);
        return this._isUpdated(true, silence);
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

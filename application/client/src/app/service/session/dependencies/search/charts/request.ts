import { Subject } from '@platform/env/subscription';
import { scheme_color_match, getNextColor } from '@styles/colors';
import { DisableConvertable } from '../disabled/converting';
import { Hash, Recognizable } from '@platform/types/storage/entry';
import { Json } from '@platform/types/storage/json';
import { unique } from '@platform/env/sequence';
import { error } from '@platform/log/utils';
import { Key } from '../store';
import { Equal } from '@platform/types/env/types';
import { Updatable } from '../store';
import { UpdateEvent } from './store.update';
import { getFilterError } from '@module/util';
import { FilterRequest } from '../filters/request';

import * as regexFilters from '@platform/env/filters';
import * as obj from '@platform/env/obj';

export interface Definition {
    filter: string;
    color: string;
    stepped: boolean;
    tension: number;
    borderWidth: number;
    pointRadius: number;
    active: boolean;
    uuid: string;
}

export interface OptionalDefinition {
    filter: string;
    color?: string;
    stepped?: boolean;
    tension?: number;
    borderWidth?: number;
    pointRadius?: number;
    active?: boolean;
    uuid?: string;
}

export interface UpdateRequest {
    filter?: string;
    color?: string;
    stepped?: boolean;
    tension?: number;
    borderWidth?: number;
    pointRadius?: number;
    background?: string;
    active?: boolean;
}

export class ChartRequest
    extends Json<ChartRequest>
    implements Recognizable, DisableConvertable, Hash, Equal<ChartRequest>, Updatable<UpdateEvent>
{
    public static KEY: Key = Key.charts;

    public static fromJson(json: string): ChartRequest | Error {
        try {
            const def: Definition = JSON.parse(json);
            def.uuid = obj.getAsString(def, 'uuid');
            def.filter = obj.getAsNotEmptyString(def, 'filter');
            def.color = obj.getAsNotEmptyString(def, 'color');
            def.stepped = obj.getAsBool(def, 'stepped');
            def.tension = obj.getAsValidNumber(def, 'tension');
            def.borderWidth = obj.getAsValidNumber(def, 'borderWidth');
            def.pointRadius = obj.getAsValidNumber(def, 'pointRadius');
            def.active = obj.getAsBool(def, 'active');
            return new ChartRequest(def);
        } catch (e) {
            return new Error(error(e));
        }
    }

    public readonly definition: Definition;
    public readonly updated: Subject<UpdateEvent> = new Subject<UpdateEvent>();

    private _regex!: RegExp;
    private _hash!: string;

    static isValid(request: string | undefined): boolean {
        if (request === undefined) {
            return false;
        }
        if (request.search(/\([^(]*\)/gi) === -1) {
            return false;
        }
        return true;
    }

    static defaults(value: string): ChartRequest {
        const color = getNextColor();
        return new ChartRequest({
            filter: value,
            color: color,
        });
    }

    static getValidationError(filter: string): string | undefined {
        let error: string | undefined = getFilterError(filter, false, false, true);
        if (error !== undefined) {
            const match: RegExpMatchArray | null = error.match(/error:.+/i);
            if (match !== null && match[0] !== undefined) {
                error = match[0].trim();
            }
        }
        return error;
    }

    static fromFilter(request: FilterRequest) {
        return new ChartRequest({
            filter: request.definition.filter.filter,
            active: request.definition.active,
            color: request.definition.colors.background,
            uuid: request.definition.uuid,
        });
    }

    constructor(def: OptionalDefinition) {
        super();
        this.definition = {
            filter: def.filter,
            uuid: def.uuid === undefined ? unique() : def.uuid,
            active: def.active === undefined ? true : def.active,
            color: def.color === undefined ? scheme_color_match : def.color,
            stepped: def.stepped === undefined ? false : def.stepped,
            borderWidth: def.borderWidth === undefined ? 1 : def.borderWidth,
            tension: def.tension === undefined ? 0.1 : def.tension,
            pointRadius: def.pointRadius === undefined ? 0 : def.pointRadius,
        };
        this.update();
    }

    public destroy() {
        this.updated.destroy();
    }

    public uuid(): string {
        return this.definition.uuid;
    }

    public json(): {
        to(): string;
        from(str: string): ChartRequest | Error;
        key(): string;
    } {
        return {
            to: (): string => {
                return JSON.stringify(this.definition);
            },
            from: (json: string): ChartRequest | Error => {
                return ChartRequest.fromJson(json);
            },
            key: (): string => {
                return ChartRequest.KEY;
            },
        };
    }

    public as(): {
        regExp(): RegExp;
        filter(): string;
    } {
        return {
            regExp: (): RegExp => {
                return this._regex;
            },
            filter: (): string => {
                return this.definition.filter;
            },
        };
    }

    public alias(): string {
        return `${this.definition.filter}`;
    }

    public set(silence: boolean = false): {
        from(desc: UpdateRequest): boolean;
        color(color: string): boolean;
        stepped(stepped: boolean): boolean;
        tension(tension: number): boolean;
        borderWidth(borderWidth: number): boolean;
        pointRadius(pointRadius: number): boolean;
        state(active: boolean): boolean;
        filter(filter: string): boolean;
    } {
        return {
            from: (desc: UpdateRequest): boolean => {
                const event = new UpdateEvent(this);
                if (typeof desc.filter === 'string' && this.set(true).filter(desc.filter)) {
                    event.on().filter();
                }
                if (typeof desc.active === 'boolean' && this.set(true).state(desc.active)) {
                    event.on().state();
                }
                if (typeof desc.color === 'string' && this.set(true).color(desc.color)) {
                    event.on().color();
                }
                if (typeof desc.stepped === 'string' && this.set(true).stepped(desc.stepped)) {
                    event.on().stepped();
                }
                if (typeof desc.tension === 'number' && this.set(true).tension(desc.tension)) {
                    event.on().tension();
                }
                if (
                    typeof desc.borderWidth === 'number' &&
                    this.set(true).borderWidth(desc.borderWidth)
                ) {
                    event.on().borderWidth();
                }
                if (
                    typeof desc.pointRadius === 'number' &&
                    this.set(true).pointRadius(desc.pointRadius)
                ) {
                    event.on().pointRadius();
                }
                if (event.changed() && this.update()) {
                    this.updated.emit(event);
                }
                return event.changed();
            },
            color: (color: string): boolean => {
                this.definition.color = color;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().color());
                }
                return true;
            },
            stepped: (stepped: boolean): boolean => {
                this.definition.stepped = stepped;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().stepped());
                }
                return true;
            },
            tension: (tension: number): boolean => {
                this.definition.tension = tension;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().tension());
                }
                return true;
            },
            borderWidth: (borderWidth: number): boolean => {
                this.definition.borderWidth = borderWidth;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().borderWidth());
                }
                return true;
            },
            pointRadius: (pointRadius: number): boolean => {
                this.definition.pointRadius = pointRadius;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().pointRadius());
                }
                return true;
            },
            state: (active: boolean): boolean => {
                this.definition.active = active;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().state());
                }
                return true;
            },
            filter: (filter: string): boolean => {
                this.definition.filter = filter;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().filter());
                }
                return true;
            },
        };
    }

    public disabled(): {
        displayName(): string;
        typeRef(): Key;
        icon(): string;
    } {
        return {
            displayName: (): string => {
                return this.definition.filter;
            },
            typeRef: (): Key => {
                return Key.charts;
            },
            icon: (): string => {
                return 'show_chart';
            },
        };
    }

    public hash(): string {
        return this._hash;
    }

    public isSame(filter: ChartRequest): boolean {
        return filter.definition.filter === this.definition.filter;
    }

    protected update(): boolean {
        const prev: string = this._hash;
        this._regex = regexFilters.getMarkerRegExp(this.definition.filter, {
            reg: true,
            cases: false,
            word: false,
        });
        this._hash = `${this.definition.filter}${this.definition.color}${this.definition.stepped}${
            this.definition.borderWidth
        }${this.definition.tension}${this.definition.pointRadius}${
            this.definition.active ? '1' : '0'
        }`;
        return prev !== this._hash;
    }
}

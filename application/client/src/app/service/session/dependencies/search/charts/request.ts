import { Subject } from '@platform/env/subscription';
import { getNextColor } from '@styles/colors';
import { DisableConvertable } from '../disabled/converting';
import { Hash, Recognizable } from '@platform/types/storage/entry';
import { ChartDefinition, ChartType } from '@platform/types/chart';
import { styles } from '@ui/service/styles';
import { Json } from '@platform/types/storage/json';
import { unique } from '@platform/env/sequence';
import { error } from '@platform/log/utils';
import { Key } from '../store';
import { Equal } from '@platform/types/env/types';
import { Updatable } from '../store';
import { UpdateEvent } from './store.update';
import { getFilterError } from '@module/util';
import { serializeHtml } from '@platform/env/str';
import { settings } from '@service/settings';

import * as regexFilters from '@platform/env/filters';
import * as obj from '@platform/env/obj';

export { ChartType };

export interface OptionalDefinition {
    filter: string;
    color?: string;
    widths?: {
        line: number;
        point: number;
    };
    active?: boolean;
    type?: ChartType;
    uuid?: string;
}

export interface OptionalColors {
    color?: string;
    background?: string;
}

export interface UpdateRequest {
    filter?: string;
    color?: string;
    line?: number;
    point?: number;
    active?: boolean;
    type?: ChartType;
}

export class ChartRequest
    extends Json<ChartRequest>
    implements Recognizable, DisableConvertable, Hash, Equal<ChartRequest>, Updatable<UpdateEvent>
{
    public static KEY: Key = Key.charts;
    public static DEFAULT_LINE_WIDTH = 1;
    public static DEFAULT_POINT_RADIUS = 0;

    public static fromJson(json: string): ChartRequest | Error {
        try {
            const def: ChartDefinition = JSON.parse(json);
            def.uuid = obj.getAsString(def, 'uuid');
            def.filter = obj.getAsNotEmptyString(def, 'filter');
            def.color = obj.getAsNotEmptyString(def, 'color');
            def.widths = obj.getAsObj(def, 'widths');
            def.widths.line = obj.getAsValidNumber(def.widths, 'line');
            def.widths.point = obj.getAsValidNumber(def.widths, 'point');
            def.active = obj.getAsBool(def, 'active');
            const type = obj.getAsNotEmptyStringOrAsUndefined(def, 'type');
            def.type = type === undefined ? ChartType.Linear : (type as ChartType);
            return new ChartRequest(def);
        } catch (e) {
            return new Error(error(e));
        }
    }

    public static fromV2(smth: { [key: string]: unknown }): ChartRequest | Error {
        try {
            return new ChartRequest({
                uuid: obj.getAsString(smth, 'guid'),
                filter: obj.getAsNotEmptyString(smth, 'request'),
                color: obj.getAsNotEmptyString(smth, 'color'),
                active: obj.getAsBool(smth, 'active'),
            });
        } catch (e) {
            return new Error(error(e));
        }
    }

    public readonly definition: ChartDefinition;
    public readonly updated: Subject<UpdateEvent> = new Subject<UpdateEvent>();

    private _regex!: RegExp;
    private _safeRegExp!: RegExp;
    private _hash!: string;

    static isValid(filter: string | undefined): boolean {
        return filter === undefined
            ? false
            : getFilterError(filter, false, false, true) === undefined
            ? regexFilters.hasGroups(filter)
            : false;
    }

    static getValidationError(filter: string): string | undefined {
        let error: string | undefined = getFilterError(filter, false, false, true);
        if (error !== undefined) {
            const match: RegExpMatchArray | null = error.match(/error:.+/i);
            if (match !== null && match[0] !== undefined) {
                error = match[0].trim();
            }
        } else if (!regexFilters.hasGroups(filter)) {
            error = `No groups`;
        }
        return error;
    }

    static defaults(value: string): ChartRequest {
        const color = getNextColor();
        return new ChartRequest({
            filter: value,
            color: color,
            widths: {
                line: ChartRequest.DEFAULT_LINE_WIDTH,
                point: ChartRequest.DEFAULT_POINT_RADIUS,
            },
            type: ChartType.Linear,
        });
    }

    static getHashByDefinition(def: ChartDefinition): string {
        return `${def.filter}${def.color}${def.widths.line}${def.widths.point}${def.type}${
            def.active ? '1' : '0'
        }`;
    }

    constructor(def: OptionalDefinition) {
        super();
        const defaultMatchColor =
            settings.defaults['general.colors.default_chart'] === undefined
                ? styles.colors().scheme_color_match
                : settings.defaults['general.colors.default_chart'];
        this.definition = {
            filter: def.filter,
            uuid: def.uuid === undefined ? unique() : def.uuid,
            active: def.active === undefined ? true : def.active,
            color: def.color === undefined ? defaultMatchColor : def.color,
            type: def.type === undefined ? ChartType.Linear : def.type,
            widths:
                def.widths === undefined
                    ? {
                          line: ChartRequest.DEFAULT_LINE_WIDTH,
                          point: ChartRequest.DEFAULT_POINT_RADIUS,
                      }
                    : def.widths,
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
        serializedRegExp(): RegExp;
        filter(): string;
    } {
        return {
            regExp: (): RegExp => {
                return this._regex;
            },
            serializedRegExp: (): RegExp => {
                return this._safeRegExp;
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
        line(width: number): boolean;
        point(width: number): boolean;
        state(active: boolean): boolean;
        filter(filter: string): boolean;
        type(type: ChartType): boolean;
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
                if (typeof desc.line === 'number' && this.set(true).line(desc.line)) {
                    event.on().line();
                }
                if (typeof desc.point === 'number' && this.set(true).point(desc.point)) {
                    event.on().point();
                }
                if (desc.type !== undefined && this.set(true).type(desc.type)) {
                    event.on().point();
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
            line: (width: number): boolean => {
                this.definition.widths.line = width;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().line());
                }
                return true;
            },
            point: (width: number): boolean => {
                this.definition.widths.point = width;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().point());
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
            type: (type: ChartType): boolean => {
                this.definition.type = type;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().type());
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
                return 'bar_chart';
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
            word: false,
            cases: false,
        });
        this._safeRegExp = regexFilters.getMarkerRegExp(serializeHtml(this.definition.filter), {
            reg: true,
            word: false,
            cases: false,
        });
        this._hash = `${this.definition.filter}${this.definition.color}${
            this.definition.widths.line
        }${this.definition.widths.point}${this.definition.type}${
            this.definition.active ? '1' : '0'
        }`;
        return prev !== this._hash;
    }
}

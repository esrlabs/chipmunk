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

import * as regexFilters from '@platform/env/filters';
import * as obj from '@platform/env/obj';

export interface Definition {
    filter: string;
    color: string;
    widths: {
        line: number;
        point: number;
    };
    active: boolean;
    uuid: string;
}

export interface OptionalDefinition {
    filter: string;
    color?: string;
    widths?: {
        line: number;
        point: number;
    };
    active?: boolean;
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
            const def: Definition = JSON.parse(json);
            def.uuid = obj.getAsString(def, 'uuid');
            def.filter = obj.getAsNotEmptyString(def, 'filter');
            def.color = obj.getAsNotEmptyString(def, 'color');
            def.widths = obj.getAsObj(def, 'widths');
            def.widths.line = obj.getAsValidNumber(def.widths, 'line');
            def.widths.point = obj.getAsValidNumber(def.widths, 'point');
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

    static isValid(filter: string | undefined): boolean {
        return filter === undefined
            ? false
            : getFilterError(filter, false, false, true) === undefined;
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

    static defaults(value: string): ChartRequest {
        const color = getNextColor();
        return new ChartRequest({
            filter: value,
            color: color,
            widths: {
                line: ChartRequest.DEFAULT_LINE_WIDTH,
                point: ChartRequest.DEFAULT_POINT_RADIUS,
            },
        });
    }

    constructor(def: OptionalDefinition) {
        super();
        this.definition = {
            filter: def.filter,
            uuid: def.uuid === undefined ? unique() : def.uuid,
            active: def.active === undefined ? true : def.active,
            color: def.color === undefined ? scheme_color_match : def.color,
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
        line(width: number): boolean;
        point(width: number): boolean;
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
                if (typeof desc.line === 'number' && this.set(true).line(desc.line)) {
                    event.on().line();
                }
                if (typeof desc.point === 'number' && this.set(true).point(desc.point)) {
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
                return 'chart';
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
        this._hash = `${this.definition.filter}${this.definition.color}${
            this.definition.widths.line
        }${this.definition.widths.point}${this.definition.active ? '1' : '0'}`;
        return prev !== this._hash;
    }
}

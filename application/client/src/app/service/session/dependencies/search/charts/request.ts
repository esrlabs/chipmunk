import { Subject } from '@platform/env/subscription';
import { getContrastColor, scheme_color_match, getNextColor } from '@styles/colors';
import { DisableConvertable } from '../disabled/converting';
import { Hash, Recognizable } from '@platform/types/storage/entry';
import { Json } from '@platform/types/storage/json';
import { unique } from '@platform/env/sequence';
import { error } from '@platform/env/logger';
import { Key } from '../store';
import { Equal } from '@platform/types/env/types';
import { Updatable } from '../store';
import { UpdateEvent } from './store.update';

import * as regexFilters from '@platform/env/filters';
import * as regex from '@platform/env/regex';
import * as obj from '@platform/env/obj';

export interface Definition {
    filter: string;
    colors: Colors;
    active: boolean;
    uuid: string;
}

export interface Colors {
    color: string;
    background: string;
}

export interface OptionalDefinition {
    filter: string;
    colors?: Colors;
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
    background?: string;
    active?: boolean;
}

export class ChartRequest
    extends Json<ChartRequest>
    implements Recognizable, DisableConvertable, Hash, Equal<ChartRequest>, Updatable<UpdateEvent>
{
    public static KEY: Key = Key.filters;

    public static fromJson(json: string): ChartRequest | Error {
        try {
            const def: Definition = JSON.parse(json);
            def.uuid = obj.getAsString(def, 'uuid');
            def.filter = obj.getAsObj(def, 'filter');
            def.filter = obj.getAsNotEmptyString(def.filter, 'filter');
            def.colors = obj.getAsObj(def, 'colors');
            def.colors.color = obj.getAsNotEmptyString(def.colors, 'color');
            def.colors.background = obj.getAsNotEmptyString(def.colors, 'background');
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
        if (!regex.isValid(request)) {
            return false;
        }
        return true;
    }

    static defaults(value: string): ChartRequest {
        const color = getNextColor();
        return new ChartRequest({
            filter: value,
            colors: {
                background: color,
                color: getContrastColor(color, true),
            },
        });
    }

    constructor(def: OptionalDefinition) {
        super();
        this.definition = {
            filter: def.filter,
            uuid: def.uuid === undefined ? unique() : def.uuid,
            active: def.active === undefined ? true : def.active,
            colors: {
                color:
                    def.colors === undefined
                        ? getContrastColor(scheme_color_match, true)
                        : def.colors.color === undefined
                        ? getContrastColor(scheme_color_match, true)
                        : def.colors.color,
                background:
                    def.colors === undefined
                        ? scheme_color_match
                        : def.colors.background === undefined
                        ? scheme_color_match
                        : def.colors.background,
            },
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
        background(background: string): boolean;
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
                    event.on().colors();
                }
                if (
                    typeof desc.background === 'string' &&
                    this.set(true).background(desc.background)
                ) {
                    event.on().colors();
                }
                if (event.changed() && this.update()) {
                    this.updated.emit(event);
                }
                return event.changed();
            },
            color: (color: string): boolean => {
                this.definition.colors.color = color;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().colors());
                }
                return true;
            },
            background: (background: string): boolean => {
                this.definition.colors.background = background;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().colors());
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
            cases: false,
            word: false,
        });
        this._hash = this.definition.filter;
        return prev !== this._hash;
    }
}

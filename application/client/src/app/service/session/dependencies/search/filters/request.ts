import { Subject } from '@platform/env/subscription';
import { getContrastColor, scheme_color_match, getNextColor } from '@styles/colors';
import { DisableConvertable } from '../disabled/converting';
import { IFilter, IFilterFlags } from '@platform/types/filter';
import { Hash, Recognizable } from '@platform/types/storage/entry';
import { Json } from '@platform/types/storage/json';
import { unique } from '@platform/env/sequence';
import { error } from '@platform/log/utils';
import { Key } from '../store';
import { Equal } from '@platform/types/env/types';
import { Updatable } from '../store';
import { UpdateEvent } from './store.update';
import { getFilterError } from '@module/util';
import { serializeHtml } from '@platform/env/str';

import * as regexFilters from '@platform/env/filters';
import * as obj from '@platform/env/obj';

export interface Definition {
    filter: IFilter;
    colors: Colors;
    active: boolean;
    uuid: string;
}

export interface Colors {
    color: string;
    background: string;
}

export interface OptionalDefinition {
    filter: IFilter;
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
    flags?: IFilterFlags;
    color?: string;
    background?: string;
    active?: boolean;
}

export class FilterRequest
    extends Json<FilterRequest>
    implements Recognizable, DisableConvertable, Hash, Equal<FilterRequest>, Updatable<UpdateEvent>
{
    public static KEY: Key = Key.filters;

    public static fromDefinition(def: IFilter): FilterRequest {
        return new FilterRequest({
            filter: def,
        });
    }

    public static fromJson(json: string): FilterRequest | Error {
        try {
            const def: Definition = JSON.parse(json);
            def.uuid = obj.getAsString(def, 'uuid');
            def.filter = obj.getAsObj(def, 'filter');
            def.filter.flags = obj.getAsObj(def.filter, 'flags');
            def.filter.filter = obj.getAsNotEmptyString(def.filter, 'filter');
            def.colors = obj.getAsObj(def, 'colors');
            def.colors.color = obj.getAsNotEmptyString(def.colors, 'color');
            def.colors.background = obj.getAsNotEmptyString(def.colors, 'background');
            def.active = obj.getAsBool(def, 'active');
            return new FilterRequest(def);
        } catch (e) {
            return new Error(error(e));
        }
    }

    static isValid(filter: IFilter): boolean {
        return (
            getFilterError(
                filter.filter,
                filter.flags.cases,
                filter.flags.word,
                filter.flags.reg,
            ) === undefined
        );
    }

    static getValidationError(filter: IFilter): string | undefined {
        let error: string | undefined = getFilterError(
            filter.filter,
            filter.flags.cases,
            filter.flags.word,
            filter.flags.reg,
        );
        if (error !== undefined) {
            const match: RegExpMatchArray | null = error.match(/error:.+/i);
            if (match !== null && match[0] !== undefined) {
                error = match[0].trim();
            }
        }
        return error;
    }

    static defaults(value: string): FilterRequest {
        const color = getNextColor();
        return new FilterRequest({
            filter: { filter: value, flags: { reg: true, word: false, cases: false } },
            colors: {
                background: color,
                color: getContrastColor(color, true),
            },
        });
    }

    public readonly definition: Definition;
    public readonly updated: Subject<UpdateEvent> = new Subject<UpdateEvent>();

    private _regex!: RegExp;
    private _safeRegExp!: RegExp;
    private _hash!: string;
    public found: number = 0;

    constructor(def: OptionalDefinition) {
        super();
        this.definition = {
            filter: {
                filter: def.filter.filter,
                flags: Object.assign({}, def.filter.flags),
            },
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
        from(str: string): FilterRequest | Error;
        key(): string;
    } {
        return {
            to: (): string => {
                return JSON.stringify(this.definition);
            },
            from: (json: string): FilterRequest | Error => {
                return FilterRequest.fromJson(json);
            },
            key: (): string => {
                return FilterRequest.KEY;
            },
        };
    }

    public as(): {
        regExp(): RegExp;
        serializedRegExp(): RegExp;
        filter(): IFilter;
    } {
        return {
            regExp: (): RegExp => {
                return this._regex;
            },
            serializedRegExp: (): RegExp => {
                return this._safeRegExp;
            },
            filter: (): IFilter => {
                return {
                    filter: this.definition.filter.filter,
                    flags: Object.assign({}, this.definition.filter.flags),
                };
            },
        };
    }

    public alias(): string {
        return `${this.definition.filter.filter}:${this.definition.filter.flags.reg ? '1' : '0'}${
            !this.definition.filter.flags.cases ? '1' : '0'
        }${this.definition.filter.flags.word ? '1' : '0'}`;
    }

    public set(silence: boolean = false): {
        from(desc: UpdateRequest): boolean;
        color(color: string): boolean;
        background(background: string): boolean;
        state(active: boolean): boolean;
        flags(flags: IFilterFlags): boolean;
        filter(filter: string): boolean;
        found(number: number): boolean;
    } {
        return {
            from: (desc: UpdateRequest): boolean => {
                const event = new UpdateEvent(this);
                if (typeof desc.filter === 'string' && this.set(true).filter(desc.filter)) {
                    event.on().filter();
                }
                if (typeof desc.flags === 'string' && this.set(true).flags(desc.flags)) {
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
            flags: (flags: IFilterFlags): boolean => {
                this.definition.filter.flags = Object.assign({}, flags);
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().filter());
                }
                return true;
            },
            filter: (filter: string): boolean => {
                this.definition.filter.filter = filter;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().filter());
                }
                return true;
            },
            found: (found: number): boolean => {
                this.found = found;
                if (!silence && this.update()) {
                    this.updated.emit(new UpdateEvent(this).on().stat());
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
                return this.definition.filter.filter;
            },
            typeRef: (): Key => {
                return Key.filters;
            },
            icon: (): string => {
                return 'search';
            },
        };
    }

    public hash(): string {
        return this._hash;
    }

    public isSame(filter: FilterRequest): boolean {
        const hash = (f: FilterRequest) => {
            return `${f.definition.filter.filter}|${f.definition.filter.flags.cases}|${f.definition.filter.flags.reg}|${f.definition.filter.flags.word}`;
        };
        return hash(filter) === hash(this);
    }

    protected update(): boolean {
        const prev: string = this._hash;
        this._regex = regexFilters.getMarkerRegExp(
            this.definition.filter.filter,
            this.definition.filter.flags,
        );
        this._safeRegExp = regexFilters.getMarkerRegExp(
            serializeHtml(this.definition.filter.filter),
            this.definition.filter.flags,
        );
        this._hash = `${this.definition.filter.filter}${
            this.definition.filter.flags.cases ? 'c' : ''
        }${this.definition.filter.flags.reg ? 'r' : ''}${
            this.definition.filter.flags.word ? 'w' : ''
        }${this.definition.colors.color}${this.definition.colors.background}${
            this.definition.active ? '1' : '0'
        }`;
        return prev !== this._hash;
    }
}

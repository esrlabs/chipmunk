import { Subject } from '@platform/env/subscription';
import { getContrastColor, scheme_color_accent } from '@styles/colors';
import { DisableConvertable } from '../disabled/converting';
import { IFilter, IFilterFlags } from '@platform/types/filter';
import { EntryConvertable, Entry, Recognizable } from '@platform/types/storage/entry';
import { Json } from '@platform/types/storage/json';
import { unique } from '@platform/env/sequence';
import { error } from '@platform/env/logger';
import { Key } from '../store';

import * as regexFilters from '@platform/env/filters';
import * as regex from '@platform/env/regex';
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

export interface UpdateEvent {
    filter: FilterRequest;
    updated: {
        filter: boolean;
        state: boolean;
        colors: boolean;
        stat: boolean;
    };
}

export class FilterRequest
    extends Json<FilterRequest>
    implements Recognizable, DisableConvertable, EntryConvertable
{
    public static KEY: Key = Key.filters;
    public static from(input: Entry | string): FilterRequest | Error {
        let entry: Entry | Error;
        if (typeof input === 'string') {
            entry = EntryConvertable.from(input);
        } else {
            entry = input;
        }
        if (entry instanceof Error) {
            return entry;
        }
        const request = new FilterRequest({
            filter: { filter: '', flags: { cases: true, word: false, reg: false } },
        });
        const error = request.entry().from(entry);
        if (error instanceof Error) {
            return error;
        }
        return request;
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

    public readonly definition: Definition;
    public readonly subjects: {
        updated: Subject<UpdateEvent>;
    } = {
        updated: new Subject<UpdateEvent>(),
    };

    private _regex!: RegExp;
    private _hash!: string;
    public found: number = 0;

    static isValid(request: string | undefined): boolean {
        if (request === undefined) {
            return false;
        }
        if (!regex.isValid(request)) {
            return false;
        }
        return true;
    }

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
                        ? getContrastColor(scheme_color_accent, true)
                        : def.colors.color === undefined
                        ? getContrastColor(scheme_color_accent, true)
                        : def.colors.color,
                background:
                    def.colors === undefined
                        ? scheme_color_accent
                        : def.colors.background === undefined
                        ? scheme_color_accent
                        : def.colors.background,
            },
        };
        this.update();
    }

    public destroy() {
        this.subjects.updated.destroy();
    }

    public uuid(): string {
        return this.definition.uuid;
    }

    public json(): {
        to(): string;
        from(str: string): FilterRequest | Error;
        key(): string;
    } {
        const self = this;
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

    public entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
        updated(): Subject<void>;
    } {
        const self = this;
        return {
            to: (): Entry => {
                return {
                    uuid: this.definition.uuid,
                    content: JSON.stringify(this.definition),
                };
            },
            from: (entry: Entry): Error | undefined => {
                const filter = FilterRequest.fromJson(entry.content);
                if (filter instanceof Error) {
                    return filter;
                }
                this.definition.uuid = filter.definition.uuid;
                this.definition.filter = filter.definition.filter;
                this.definition.colors = filter.definition.colors;
                this.definition.active = filter.definition.active;
                return undefined;
            },
            hash: (): string => {
                return `${this.definition.filter.filter}${
                    this.definition.filter.flags.cases ? 'c' : ''
                }${this.definition.filter.flags.reg ? 'r' : ''}${
                    this.definition.filter.flags.word ? 'w' : ''
                }${this.definition.colors.color}${this.definition.colors.background}${
                    this.definition.active ? '1' : '0'
                }`;
            },
            uuid: (): string => {
                return this.definition.uuid;
            },
            updated: (): Subject<void> => {
                return this.subjects.updated.to<void>();
            },
        };
    }

    public as(): {
        regExp(): RegExp;
        filter(): IFilter;
    } {
        return {
            regExp: (): RegExp => {
                return this._regex;
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
                const event: UpdateEvent = {
                    updated: {
                        filter: false,
                        colors: false,
                        state: false,
                        stat: false,
                    },
                    filter: this,
                };
                if (typeof desc.filter === 'string' && this.set(true).filter(desc.filter)) {
                    event.updated.filter = true;
                }
                if (typeof desc.flags === 'string' && this.set(true).flags(desc.flags)) {
                    event.updated.filter = true;
                }
                if (typeof desc.active === 'boolean' && this.set(true).state(desc.active)) {
                    event.updated.state = true;
                }
                if (typeof desc.color === 'string' && this.set(true).color(desc.color)) {
                    event.updated.colors = true;
                }
                if (
                    typeof desc.background === 'string' &&
                    this.set(true).background(desc.background)
                ) {
                    event.updated.colors = true;
                }
                const hasToBeEmitted: boolean =
                    event.updated.filter || event.updated.state || event.updated.colors;
                if (hasToBeEmitted) {
                    this.subjects.updated.emit(event);
                }
                return hasToBeEmitted;
            },
            color: (color: string): boolean => {
                if (this.definition.colors.color === color) {
                    return false;
                }
                this.definition.colors.color = color;
                if (!silence) {
                    this.subjects.updated.emit({
                        updated: {
                            filter: false,
                            colors: true,
                            state: false,
                            stat: false,
                        },
                        filter: this,
                    });
                }
                return true;
            },
            background: (background: string): boolean => {
                if (this.definition.colors.background === background) {
                    return false;
                }
                this.definition.colors.background = background;
                if (!silence) {
                    this.subjects.updated.emit({
                        updated: {
                            filter: false,
                            colors: true,
                            state: false,
                            stat: false,
                        },
                        filter: this,
                    });
                }
                return true;
            },
            state: (active: boolean): boolean => {
                if (this.definition.active === active) {
                    return false;
                }
                this.definition.active = active;
                if (!silence) {
                    this.subjects.updated.emit({
                        updated: {
                            filter: false,
                            colors: false,
                            state: true,
                            stat: false,
                        },
                        filter: this,
                    });
                }
                return true;
            },
            flags: (flags: IFilterFlags): boolean => {
                this.definition.filter.flags = Object.assign({}, flags);
                if (!this.update()) {
                    return false;
                }
                if (!silence) {
                    this.subjects.updated.emit({
                        updated: {
                            filter: true,
                            colors: false,
                            state: false,
                            stat: false,
                        },
                        filter: this,
                    });
                }
                return true;
            },
            filter: (filter: string): boolean => {
                this.definition.filter.filter = filter;
                if (!this.update()) {
                    return false;
                }
                if (!silence) {
                    this.subjects.updated.emit({
                        updated: {
                            filter: true,
                            colors: false,
                            state: false,
                            stat: false,
                        },
                        filter: this,
                    });
                }
                return true;
            },
            found: (found: number): boolean => {
                if (this.found === found) {
                    return false;
                }
                this.found = found;
                if (!silence) {
                    this.subjects.updated.emit({
                        updated: {
                            filter: false,
                            colors: false,
                            state: false,
                            stat: true,
                        },
                        filter: this,
                    });
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
        this._hash = this._regex.source + this._regex.flags;
        return prev !== this._hash;
    }
}

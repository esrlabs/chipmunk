import { EFlag, IFilter } from '@platform/types/filter';
import { Entity } from '../../providers/definitions/entity';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ProviderFilters } from '../provider';

import * as obj from '@platform/env/obj';

export interface IFilterColors {
    color: string;
    background: string;
}

export class State {
    public filter: IFilter;
    public colors: IFilterColors;
    public active: boolean = false;
    public provider: ProviderFilters;
    public entity: Entity<FilterRequest>;
    public found: number = 0;

    private _isValidRegex: boolean = true;
    private _error: string | undefined;

    constructor(entity: Entity<FilterRequest>, prodider: ProviderFilters) {
        this.filter = obj.clone<IFilter>(entity.extract().definition.filter);
        this.colors = obj.clone<IFilterColors>(entity.extract().definition.colors);
        this.active = entity.extract().definition.active;
        this.provider = prodider;
        this.entity = entity;
        this._update();
    }

    public get isValidRegex(): boolean {
        return this._isValidRegex;
    }

    public setState(checked: boolean) {
        this.active = checked;
        this.entity.extract().set().state(checked);
    }

    public update(): {
        filter(): void;
        colors(): void;
        state(): void;
        stat(): void;
    } {
        return {
            filter: (): void => {
                this.filter = obj.clone<IFilter>(this.entity.extract().definition.filter);
            },
            colors: (): void => {
                this.colors = obj.clone<IFilterColors>(this.entity.extract().definition.colors);
            },
            state: (): void => {
                this.active = this.entity.extract().definition.active;
            },
            stat: (): void => {
                this.found = this.entity.extract().found;
            },
        };
    }

    public toggleFilter(flag: EFlag) {
        if (!this._canToggle(flag)) {
            return;
        }
        this.filter.flags[flag] = !this.filter.flags[flag];
        this.entity.extract().set().flags(this.filter.flags);
    }

    public edit(): {
        drop(): void;
        accept(): void;
    } {
        return {
            drop: (): void => {
                this.filter.filter = this.entity.extract().definition.filter.filter;
                this.provider.edit().out();
            },
            accept: (): void => {
                this._update();
                if (this.filter.filter.trim() !== '' && this._error === undefined) {
                    this.entity.extract().set().filter(this.filter.filter);
                } else {
                    this.filter.filter = this.entity.extract().definition.filter.filter;
                }
                this.provider.edit().out();
            },
        };
    }

    public get error(): string | undefined {
        return this._error;
    }

    private _canToggle(flag: EFlag): boolean {
        return (
            (flag === EFlag.reg && !this.filter.flags.reg && this._isValidRegex) ||
            this.filter.flags.reg
        );
    }

    private _update() {
        this._checkSpecifiedRegex();
        this._checkGeneralRegex();
    }

    private _checkSpecifiedRegex() {
        this._error = FilterRequest.getValidationError(this.filter);
    }

    private _checkGeneralRegex() {
        this._isValidRegex = FilterRequest.isValid({
            filter: this.filter.filter,
            flags: {
                cases: this.filter.flags.cases,
                word: this.filter.flags.word,
                reg: true,
            },
        });
    }
}

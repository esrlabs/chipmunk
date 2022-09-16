import { IFilter } from '@platform/types/filter';
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

    constructor(entity: Entity<FilterRequest>, prodider: ProviderFilters) {
        this.filter = obj.clone<IFilter>(entity.extract().definition.filter);
        this.colors = obj.clone<IFilterColors>(entity.extract().definition.colors);
        this.active = entity.extract().definition.active;
        this.provider = prodider;
        this.entity = entity;
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

    public toggleFilter(flag: 'cases' | 'word' | 'reg') {
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
                if (this.filter.filter.trim() !== '' && FilterRequest.isValid(this.filter.filter)) {
                    this.entity.extract().set().filter(this.filter.filter);
                } else {
                    this.filter.filter = this.entity.extract().definition.filter.filter;
                }
                this.provider.edit().out();
            },
        };
    }
}

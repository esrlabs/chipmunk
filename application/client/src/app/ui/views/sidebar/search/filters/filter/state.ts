import { IFilter } from '@platform/types/filter';
import { Entity } from '../../providers/definitions/entity';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ProviderFilters } from '../provider';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { stop } from '@ui/env/dom';
import { ErrorHandler } from '@ui/views/toolbar/search/input/error';

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
    public readonly error: ErrorHandler = new ErrorHandler();

    constructor(entity: Entity<FilterRequest>, prodider: ProviderFilters) {
        this.filter = obj.clone<IFilter>(entity.extract().definition.filter);
        this.colors = obj.clone<IFilterColors>(entity.extract().definition.colors);
        this.active = entity.extract().definition.active;
        this.provider = prodider;
        this.entity = entity;
    }

    public onStateChange(event: MatCheckboxChange) {
        this.active = event.checked;
        this.entity.extract().set().state(event.checked);
        this.update();
    }

    public onFlagsToggle(event: MouseEvent, flag: 'cases' | 'word' | 'reg') {
        switch (flag) {
            case 'cases':
                this.filter.flags.cases = !this.filter.flags.cases;
                this.error.set().caseSensitive(this.filter.flags.cases);
                break;
            case 'word':
                this.filter.flags.word = !this.filter.flags.word;
                this.error.set().wholeWord(this.filter.flags.word);
                break;
            case 'reg':
                this.filter.flags.reg = !this.filter.flags.reg;
                this.error.set().regex(this.filter.flags.reg);
                break;
        }
        this.entity.extract().set().flags(this.filter.flags);
        stop(event);
    }

    public onRequestInputKeyUp(event: KeyboardEvent) {
        if (this.provider === undefined) {
            return;
        }
        if (['Escape', 'Enter'].indexOf(event.code) === -1) {
            this.error
                .set()
                .value(this.filter.filter)
                .catch((err: Error) => {
                    console.log(`Failed to check filter modification due to error: ${err.message}`);
                });
            return;
        }
        switch (event.code) {
            case 'Escape':
                this._edit().drop();
                break;
            case 'Enter':
                this._edit().accept();
                break;
        }
        this.update();
    }

    public onRequestInputBlur() {
        if (this.provider === undefined) {
            return;
        }
        this._edit().drop();
        this.update();
    }

    public onDoubleClick(event: MouseEvent) {
        this.provider !== undefined && this.provider.select().doubleclick(event, this.entity);
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

    private _edit(): {
        drop(): void;
        accept(): void;
    } {
        return {
            drop: (): void => {
                this.filter.filter = this.entity.extract().definition.filter.filter;
                this.provider.edit().out();
            },
            accept: (): void => {
                if (
                    this.filter.filter !== undefined &&
                    this.filter.filter.trim() !== '' &&
                    !this.error.hasError()
                ) {
                    this.entity.extract().set().filter(this.filter.filter);
                } else {
                    this.filter.filter = this.entity.extract().definition.filter.filter;
                }
                this.provider.edit().out();
            },
        };
    }
}

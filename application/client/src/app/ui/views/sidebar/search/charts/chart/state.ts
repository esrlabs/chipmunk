import { Entity } from '../../providers/definitions/entity';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ProviderCharts } from '../provider';

import * as obj from '@platform/env/obj';

export class State {
    public filter: string;
    public color: string;
    public line: number;
    public point: number;
    public active: boolean = false;
    public provider: ProviderCharts;
    public entity: Entity<ChartRequest>;
    public found: number = 0;

    private _isValidRegex: boolean = true;
    private _error: string | undefined;

    constructor(entity: Entity<ChartRequest>, prodider: ProviderCharts) {
        this.filter = obj.clone<string>(entity.extract().definition.filter);
        this.color = obj.clone<string>(entity.extract().definition.color);
        this.line = obj.clone<number>(entity.extract().definition.widths.line);
        this.point = obj.clone<number>(entity.extract().definition.widths.point);
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
        color(): void;
        line(): void;
        point(): void;
        state(): void;
    } {
        return {
            filter: (): void => {
                this.filter = obj.clone<string>(this.entity.extract().definition.filter);
            },
            color: (): void => {
                this.color = obj.clone<string>(this.entity.extract().definition.color);
            },
            line: (): void => {
                this.line = obj.clone<number>(this.entity.extract().definition.widths.line);
            },
            point: (): void => {
                this.point = obj.clone<number>(this.entity.extract().definition.widths.point);
            },
            state: (): void => {
                this.active = this.entity.extract().definition.active;
            },
        };
    }

    public edit(): {
        drop(): void;
        accept(): void;
    } {
        return {
            drop: (): void => {
                this.filter = this.entity.extract().definition.filter;
                this.provider.edit().out();
            },
            accept: (): void => {
                this._update();
                if (this.filter.trim() !== '' && this._error === undefined) {
                    this.entity.extract().set().filter(this.filter);
                } else {
                    this.filter = this.entity.extract().definition.filter;
                }
                this.provider.edit().out();
            },
        };
    }

    public get error(): string | undefined {
        return this._error;
    }

    private _update() {
        this._checkSpecifiedRegex();
        this._checkGeneralRegex();
    }

    private _checkSpecifiedRegex() {
        this._error = ChartRequest.getValidationError(this.filter);
    }

    private _checkGeneralRegex() {
        this._isValidRegex = ChartRequest.isValid(this.filter);
    }
}

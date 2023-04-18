import { Entity } from '../../providers/definitions/entity';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ProviderCharts } from '../provider';

export class State {
    public filter: string;
    public color: string;
    public active: boolean = false;
    public provider: ProviderCharts;
    public entity: Entity<ChartRequest>;
    public found: number = 0;

    private _isValidRegex: boolean = true;
    private _error: string | undefined;

    constructor(entity: Entity<ChartRequest>, prodider: ProviderCharts) {
        this.filter = entity.extract().definition.filter.slice();
        this.color = entity.extract().definition.color.slice();
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
        state(): void;
    } {
        return {
            filter: (): void => {
                this.filter = this.entity.extract().definition.filter.slice();
            },
            color: (): void => {
                this.color = this.entity.extract().definition.color.slice();
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

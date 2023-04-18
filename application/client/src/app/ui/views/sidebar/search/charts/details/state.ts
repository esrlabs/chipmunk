import { ChangeDetectorRef } from '@angular/core';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ProviderCharts } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { CColors } from '@styles/colors';
import { Env } from '@service/ilc';

interface IChartOptions {
    color: string | undefined;
    stepped: boolean;
    tension: number;
    borderWidth: number;
    pointRadius: number;
}

interface ISliderOptions {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly discrete: boolean;
}

interface IDefaultSettings {
    readonly borderWidth: ISliderOptions;
    readonly tension: ISliderOptions;
    readonly pointRadius: ISliderOptions;
}

enum ESlider {
    tension = 'tension',
    borderWidth = 'borderWidth',
    pointRadius = 'pointRadius',
}

export class State {
    public colors: string[] = [];
    public options: IChartOptions = {
        color: undefined,
        stepped: false,
        borderWidth: 1,
        tension: 0.1,
        pointRadius: 0,
    };
    public readonly ESlider = ESlider;
    public readonly lineTypeOptions: { readonly option: string; readonly stepped: boolean }[] = [
        { option: 'Stepped Line', stepped: true },
        { option: 'Smooth Line', stepped: false },
    ];
    public defaultSettings: IDefaultSettings = {
        borderWidth: {
            min: 1,
            max: 5,
            step: 1,
            discrete: true,
        },
        tension: {
            min: 0.1,
            max: 1.0,
            step: 0.1,
            discrete: true,
        },
        pointRadius: {
            min: 0,
            max: 5,
            step: 1,
            discrete: true,
        },
    };

    private _entity: Entity<ChartRequest> | undefined;
    private _cdRef!: ChangeDetectorRef;
    private _provider!: ProviderCharts;

    constructor(cdRef: ChangeDetectorRef) {
        this._cdRef = cdRef;
    }

    public init(env: Env, provider: ProviderCharts) {
        this._provider = provider;
        this._onSelection();
        env.subscriber.register(
            this._provider.subjects.selection.subscribe(this._onSelection.bind(this)),
        );
        env.subscriber.register(
            this._provider.subjects.change.subscribe(this._onChange.bind(this)),
        );
    }

    public onTypeChange() {
        this._entity && this._entity.extract().set().stepped(this.options.stepped);
    }

    public onSliderChange(event: any, slider: ESlider) {
        if (this._entity === undefined) {
            return;
        }
        this.options[slider] = event.value;
        this._entity.extract().set()[slider](event.value);
    }

    public onColorChange(color: string) {
        if (this._entity === undefined) {
            return;
        }
        this.options.color = color;
        this._entity.extract().set().color(this.options.color);
        this._cdRef.detectChanges();
    }

    private _setColors() {
        this.colors = CColors.slice();
        if (
            this.options.color === undefined ||
            this.colors.find((c) => c === this.options.color) !== undefined
        ) {
            return;
        }
        this.colors.push(this.options.color);
        this._cdRef.detectChanges();
    }

    private _onSelection() {
        this._loadSettings();
        this._onChange();
    }

    private _loadSettings() {
        this._entity = this._provider.select().single();
        if (this._entity === undefined) {
            return;
        }
        const definition = this._entity.extract().definition;
        this.options.color = definition.color;
        this.options.borderWidth = definition.borderWidth;
        this.options.tension = definition.tension;
        this.options.pointRadius = definition.pointRadius;
        this.options.stepped = definition.stepped;
        this._setColors();
    }

    private _onChange() {
        this._entity !== undefined && this._cdRef.detectChanges();
    }
}

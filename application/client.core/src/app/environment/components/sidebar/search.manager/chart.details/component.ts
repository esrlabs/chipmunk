import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, EventEmitter, NgZone, ViewChild, ViewEncapsulation, SimpleChanges, OnChanges } from '@angular/core';
import { ChartRequest } from '../../../../controller/controller.session.tab.search.charts.request';
import ChartControllers, { AChart, IOption, EOptionType, EChartType } from '../../../views/chart/charts/charts';
import { IComponentDesc } from 'chipmunk-client-material';
import { MatSlider, MatSliderChange } from '@angular/material';
import { Subject, Observable, Subscription } from 'rxjs';
import { CColors } from '../../../../conts/colors';
import { MatSelectChange, MatSelect } from '@angular/material';

interface IOptionComponent {
    component: IComponentDesc;
    caption: string;
}

interface IChartTypeOption {
    title: string;
    value: EChartType;
}

const COptionComponents = {
    [EOptionType.slider]: MatSlider,
};

const CComponentsInputs = {
    [EOptionType.slider]: {
        thumbLabel: true,
        tickInterval: 1,
    },
};

@Component({
    selector: 'app-sidebar-app-searchmanager-chart-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class SidebarAppSearchManagerChartDetailsComponent implements OnDestroy, AfterContentInit, OnChanges {

    @ViewChild(MatSelect, { static: false }) _refSelect: MatSelect;

    @Input() request: ChartRequest;

    public _ng_request: string = '';
    public _ng_color: string = '';
    public _ng_type: EChartType;
    public _ng_types: IChartTypeOption[] = [
        { title: 'Stepped Line', value: EChartType.stepped },
        { title: 'Smooth Line', value: EChartType.smooth },
    ];
    public _ng_options: IOptionComponent[] = [];
    public _ng_colors: string[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {

    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._init();
    }

    public ngOnChanges(changes: SimpleChanges) {
        this._init();
    }

    public _ng_onColorChange(color: string) {
        this._ng_color = color;
        this.request.setColor(this._ng_color);
        this._forceUpdate();
    }

    public _ng_onChartTypeChange(event: MatSelectChange) {
        this._zone.run(() => {
            this._ng_type = event.value;
            this.request.setType(event.value);
            this._refSelect.close();
            this._ng_options = this._getOptions();
            this._forceUpdate();
        });
    }

    private _init() {
        const desc = this.request.asDesc();
        this._ng_request = desc.request;
        this._ng_color = desc.color;
        this._ng_type = desc.type;
        this._ng_options = this._getOptions();
        this._setColors();
    }

    private _setColors() {
        this._ng_colors = CColors.slice();
        if (this._ng_colors.find((c => c === this._ng_color)) !== undefined) {
            return;
        }
        this._ng_colors.push(this._ng_color);
        this._forceUpdate();
    }

    private _getOptions(): IOptionComponent[] {
        if (this.request === undefined) {
            return [];
        }
        const controller: AChart | undefined = ChartControllers[this.request.getType()];
        if (controller === undefined) {
            return;
        }
        return controller.getOptions(this.request.getOptions()).map((option: IOption) => {
            // Create emitter
            const emitter: EventEmitter<MatSliderChange> = new EventEmitter<MatSliderChange>();
            // Create defaults inputs
            const inputs = Object.assign({
                value: option.value,
                change: emitter,
            }, CComponentsInputs[option.type]);
            // Subscribe emitter
            this._subscriptions[`emitter_${option.name.replace(/\s/, '_')}`] = emitter.asObservable().subscribe(this._onOptionChange.bind(this, controller, option));
            // Returns dynamic component description
            return {
                component: {
                    factory: COptionComponents[option.type],
                    inputs: Object.assign(inputs, option.option ),
                },
                caption: option.caption,
            };
        });
    }

    private _onOptionChange(controller: AChart, option: IOption, event: MatSliderChange) {
        option.value = event.value;
        // event.source.blur();
        this.request.setOptions(controller.setOption(this.request.getOptions(), option));
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

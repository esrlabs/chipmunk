// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, OnChanges } from '@angular/core';
import { IChartRequest, EChartType } from '../../../../../controller/controller.session.tab.search.charts';
import { CColors } from '../../../../../conts/colors';
import { Subscription } from 'rxjs';

export interface IOnChangeEvent {
    color?: string;
    type?: EChartType;
}

export interface IChartItem {
    request: IChartRequest;
    onChange: (event: IOnChangeEvent) => void;
}

@Component({
    selector: 'app-sidebar-app-search-chart-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchChartDetailsComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() public chart: IChartItem | undefined;

    public _ng_request: string = '';
    public _ng_color: string = '';
    public _ng_type: EChartType = EChartType.stepped;
    public _ng_colors: string[] = CColors;
    public _ng_colorIndex: number = -1;
    public _ng_types: Array<{ caption: string, value: any, }> = [
        { caption: 'Stepped Line', value: EChartType.stepped },
        { caption: 'Smooth Line', value: EChartType.smooth },
    ];

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onTypeChange = this._ng_onTypeChange.bind(this);
    }

    public ngAfterContentInit() {
        this._update();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnChanges() {
        this._update();
    }

    public _ng_onColorSelect(index: number) {
        if (this.chart === undefined) {
            return;
        }
        this._ng_color = this._ng_colors[index];
        this._updateIndexes();
        this.chart.onChange({ color: this._ng_color });
        this._cdRef.detectChanges();
    }

    public _ng_onTypeChange(value: EChartType) {
        this._ng_type = value;
        this.chart.onChange({ type: this._ng_type });
        console.log(value);
        this._cdRef.detectChanges();
    }

    private _update() {
        if (this.chart === undefined) {
            return;
        }
        this._ng_request = this.chart.request.reg.source;
        this._ng_color = this.chart.request.color;
        this._ng_type = this.chart.request.type;
        this._updateIndexes();
        this._cdRef.detectChanges();
    }

    private _updateIndexes() {
        this._ng_colorIndex = this._getIndex(this._ng_color);
    }

    private _getIndex(color: string) {
        return this._ng_colors.indexOf(color);
    }

}

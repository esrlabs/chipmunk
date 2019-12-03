// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, OnChanges } from '@angular/core';
import { IChartRequest } from '../../../../../controller/controller.session.tab.search.charts';
import { CColors } from '../../../../../conts/colors';
import { Subscription } from 'rxjs';

export interface IChartItem {
    request: IChartRequest;
    onChange: (color: string) => void;
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
    public _ng_colors: string[] = CColors;
    public _ng_colorIndex: number = -1;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
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
        this.chart.onChange(this._ng_color);
        this._cdRef.detectChanges();
    }

    private _update() {
        if (this.chart === undefined) {
            return;
        }
        this._ng_request = this.chart.request.reg.source;
        this._ng_color = this.chart.request.color;
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

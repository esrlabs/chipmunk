// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, OnChanges } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { IRequest } from '../../../../../controller/controller.session.tab.search';
import { CColors } from '../../../../../conts/colors';
import { getContrastColor } from '../../../../../theme/colors';

export interface IRequestItem {
    request: IRequest;
    onChange: (color: string, background: string) => void;
}

enum EColorSetingMode {
    auto = 'auto',
    manual = 'manual'
}

@Component({
    selector: 'app-sidebar-app-search-request-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchRequestDetailsComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() public request: IRequestItem;

    public _ng_request: string = '';
    public _ng_color: string = '';
    public _ng_background: string = '';
    public _ng_colors: string[] = CColors;
    public _ng_colorIndex: number = -1;
    public _ng_backgroundIndex: number = -1;
    public _ng_options: Array<{ value: string; caption: string}> = [
        { value: EColorSetingMode.auto, caption: 'Auto color binding' },
        { value: EColorSetingMode.manual, caption: 'Manual color definition' },
    ];

    private _colorSettingMode: EColorSetingMode = EColorSetingMode.auto;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onColorSettingModeChange = this._ng_onColorSettingModeChange.bind(this);
    }

    public ngAfterContentInit() {
        this._update();
    }

    public ngOnDestroy() {
    }

    public ngOnChanges() {
        this._update();
    }

    public _ng_onColorSelect(index: number) {
        this._ng_color = this._ng_colors[index];
        this._ng_background = this._colorSettingMode === EColorSetingMode.auto ? this._getGeneratedColor(this._ng_color, false) : this._ng_background;
        this._updateIndexes();
        this.request.onChange(this._ng_color, this._ng_background);
        this._cdRef.detectChanges();
    }

    public _ng_onBackgroundSelect(index: number) {
        this._ng_background = this._ng_colors[index];
        this._ng_color = this._colorSettingMode === EColorSetingMode.auto ? this._getGeneratedColor(this._ng_background, true) : this._ng_color;
        this._updateIndexes();
        this.request.onChange(this._ng_color, this._ng_background);
        this._cdRef.detectChanges();
    }

    public _ng_onColorSettingModeChange(value: EColorSetingMode) {
        this._colorSettingMode = value;
        if (this._colorSettingMode === EColorSetingMode.manual) {
            this._ng_background = this._ng_colors[0];
            this._ng_backgroundIndex = 0;
        }
        this._cdRef.detectChanges();
    }

    private _update() {
        if (this.request === undefined) {
            return;
        }
        this._ng_request = this.request.request.reg.source;
        this._ng_color = this.request.request.color;
        this._ng_background = this.request.request.background;
        this._updateIndexes();
        this._cdRef.detectChanges();
    }

    private _updateIndexes() {
        this._ng_colorIndex = this._getIndex(this._ng_color);
        this._ng_backgroundIndex = this._getIndex(this._ng_background);
    }

    private _getIndex(color: string) {
        return this._ng_colors.indexOf(color);
    }

    private _getGeneratedColor (hex: string, bw: boolean = false) {
        if (hex === CColors[0]) {
            hex = CColors[1];
        }
        return getContrastColor(hex, bw);
    }

}

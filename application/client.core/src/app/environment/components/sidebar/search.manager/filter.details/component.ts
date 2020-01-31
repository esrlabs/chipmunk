import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, NgZone, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { FilterRequest } from '../../../../controller/controller.session.tab.search.filters.request';
import { MatSelectChange, MatSelect } from '@angular/material';

import { CColors } from '../../../../conts/colors';
import { getContrastColor } from '../../../../theme/colors';

type TColorType = 'color' | 'background';

interface IColorOption {
    title: string;
    value: TColorType;
}

@Component({
    selector: 'app-sidebar-app-searchmanager-filter-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerFilterDetailsComponent implements OnDestroy, AfterContentInit, OnChanges {

    @ViewChild(MatSelect, { static: false }) _refSelect: MatSelect;

    @Input() request: FilterRequest;

    public _ng_request: string;
    public _ng_color: string;
    public _ng_background: string;
    public _ng_colorOptions: IColorOption[] = [
        { title: 'Background', value: 'background' },
        { title: 'Foregraund', value: 'color' },
    ];
    public _ng_colorType: TColorType = 'background';
    public _ng_currentColor: string;
    public _ng_colors: string[] = [];

    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {

    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public ngAfterContentInit() {
        if (this.request === undefined) {
            return;
        }
        this._init();
    }

    public ngOnChanges(changes: SimpleChanges) {
        this._init();
    }

    public _ng_onColorTypeChange(event: MatSelectChange) {
        this._zone.run(() => {
            this._ng_colorType = event.value;
            switch (this._ng_colorType) {
                case 'color':
                    this._ng_currentColor = this._ng_color;
                    break;
                case 'background':
                    this._ng_currentColor = this._ng_background;
                    break;
            }
            this._refSelect.close();
            this._setColors();
            this._forceUpdate();
        });
    }

    public _ng_onColorChange(color: string) {
        switch (this._ng_colorType) {
            case 'color':
                this._ng_color = color;
                this._ng_background = getContrastColor(color, false);
                break;
            case 'background':
                this._ng_background = color;
                this._ng_color = getContrastColor(color, true);
                break;
        }
        this.request.setBackground(this._ng_background);
        this.request.setColor(this._ng_color);
        this._ng_currentColor = color;
        this._forceUpdate();
    }

    private _setColors() {
        this._ng_colors = CColors.slice();
        let color: string;
        switch (this._ng_colorType) {
            case 'color':
                color = this._ng_color;
                break;
            case 'background':
                color = this._ng_background;
                break;
        }
        if (color === undefined || this._ng_colors.find((c => c === color)) !== undefined) {
            return;
        }
        this._ng_colors.push(color);
        this._forceUpdate();
    }

    private _init() {
        const desc = this.request.asDesc();
        this._ng_request = desc.request;
        this._ng_color = desc.color;
        this._ng_background = desc.background;
        this._ng_currentColor = desc.background;
        this._ng_colorType = 'background';
        this._setColors();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

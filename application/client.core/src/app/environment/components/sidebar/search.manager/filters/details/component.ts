import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, NgZone, ViewChild } from '@angular/core';
import { FilterRequest } from '../../../../../controller/controller.session.tab.search.filters.request';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import { Subject, Observable, Subscription } from 'rxjs';
import { CColors } from '../../../../../conts/colors';
import { getContrastColor } from '../../../../../theme/colors';

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

export class SidebarAppSearchManagerFilterDetailsComponent implements OnDestroy, AfterContentInit {

    @ViewChild(MatSelect) _refSelect: MatSelect;

    @Input() provider: Provider<FilterRequest>;

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

    private _entity: Entity<FilterRequest> | undefined;
    private _destroyed: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {

    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.selection = this.provider.getObservable().selection.subscribe(this._init.bind(this));
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
        if (this._entity === undefined) {
            return;
        }
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
        this._entity.getEntity().setBackground(this._ng_background);
        this._entity.getEntity().setColor(this._ng_color);
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
        this._entity = this.provider.getSingleSelection();
        if (this._entity === undefined) {
            this._ng_request = undefined;
            this._ng_color = undefined;
            this._ng_background = undefined;
            this._ng_currentColor = undefined;
        } else {
            const desc = this._entity.getEntity().asDesc();
            this._ng_request = desc.request;
            this._ng_color = desc.color;
            this._ng_background = desc.background;
            this._ng_currentColor = desc.background;
            this._ng_colorType = 'background';
            this._setColors();
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

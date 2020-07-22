import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, NgZone, ViewChild } from '@angular/core';
import { FilterRequest } from '../../../../../controller/controller.session.tab.search.filters.request';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { Subject, Observable, Subscription } from 'rxjs';
import { CColors } from '../../../../../conts/colors';
import { getContrastColor } from '../../../../../theme/colors';
import { RangeRequest } from '../../../../../controller/controller.session.tab.search.ranges.request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

type TColorType = 'color' | 'background';

interface IColorOption {
    title: string;
    value: TColorType;
}

@Component({
    selector: 'app-sidebar-app-searchmanager-timerange-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerTimerangeDetailsComponent implements OnDestroy, AfterContentInit {

    @ViewChild(MatSelect) _refSelect: MatSelect;

    @Input() provider: Provider<RangeRequest>;

    public _ng_start: Entity<FilterRequest>;
    public _ng_end: Entity<FilterRequest>;
    public _ng_reorder: Subject<void> = new Subject();
    public _ng_selected: Subject<string> = new Subject();
    public _ng_requests: FilterRequest[] = [];
    public _ng_color: string;

    public _ng_currentColor: string;
    public _ng_colors: string[] = [];

    private _entity: Entity<RangeRequest> | undefined;
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

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this._ng_start = undefined;
            this._ng_end = undefined;
            this._ng_color = undefined;
            this._ng_currentColor = undefined;
        } else {
            const desc = this._entity.getEntity().asDesc();
            this._ng_start = new Entity<FilterRequest>(desc.start, desc.start.getGUID());
            this._ng_end = new Entity<FilterRequest>(desc.end, desc.end.getGUID());
            this._ng_color = desc.color;
            this._ng_currentColor = desc.color;
            this._setColors();
        }
    }

    private _setColors() {
        this._ng_colors = CColors.slice();
        if (this._ng_color === undefined || this._ng_colors.find((c => c === this._ng_color)) !== undefined) {
            return;
        }
        this._ng_colors.push(this._ng_color);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

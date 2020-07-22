import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding, NgZone, ViewChild, OnChanges } from '@angular/core';
import { FilterRequest, IFlags, IFilterUpdateEvent } from '../../../../../controller/controller.session.tab.search.filters.request';
import { Subscription } from 'rxjs';
import { Entity } from '../../providers/entity';

@Component({
    selector: 'app-sidebar-app-searchmanager-filter-mini',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerFilterMiniComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() entity: Entity<FilterRequest>;

    public _ng_flags: IFlags;
    public _ng_request: string;
    public _ng_color: string;
    public _ng_background: string;
    public _ng_state: boolean;

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

    public ngOnChanges() {
        this._init();
    }

    private _init() {
        this._zone.run(() => {
            const desc = this.entity.getEntity().asDesc();
            this._ng_flags = desc.flags;
            this._ng_request = desc.request;
            this._ng_color = desc.color;
            this._ng_background = desc.background;
            this._ng_state = desc.active;
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

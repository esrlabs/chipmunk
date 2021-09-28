import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    OnChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import {
    FilterRequest,
    IFlags,
} from '../../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { Subscription } from 'rxjs';
import { Entity } from '../../providers/entity';

@Component({
    selector: 'app-sidebar-app-searchmanager-filter-mini',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarAppSearchManagerFilterMiniComponent
    implements OnDestroy, AfterContentInit, OnChanges
{
    @Input() entity!: Entity<FilterRequest>;

    public _ng_flags: IFlags = {
        casesensitive: false,
        wholeword: false,
        regexp: true,
    };
    public _ng_request: string | undefined;
    public _ng_color: string | undefined;
    public _ng_background: string | undefined;
    public _ng_state: boolean | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

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
        this._forceUpdate();
    }

    private _init() {
        const desc = this.entity.getEntity().asDesc();
        this._ng_flags = desc.flags;
        this._ng_request = desc.request;
        this._ng_color = desc.color;
        this._ng_background = desc.background;
        this._ng_state = desc.active;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

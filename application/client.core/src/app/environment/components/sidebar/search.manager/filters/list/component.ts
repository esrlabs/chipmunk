import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input } from '@angular/core';
import { FilterRequest } from '../../../../../controller/controller.session.tab.search.filters.request';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

import SearchManagerService, { TRequest } from '../../service/service';

@Component({
    selector: 'app-sidebar-app-searchmanager-filters',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppSearchManagerFiltersComponent implements OnDestroy, AfterContentInit {

    @Input() provider: Provider<FilterRequest>;

    public _ng_entries: Array<Entity<FilterRequest>> = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._ng_entries = this.provider.get();
        this._subscriptions.change = this.provider.getObservable().change.subscribe(this._onDataUpdate.bind(this));
    }

    public _ng_onItemDragged(event: CdkDragDrop<Entity<TRequest>[]>) {
        SearchManagerService.onDragStart(false);
        if (SearchManagerService.droppedOut) {
            return;
        }
        this.provider.itemDragged(event);
    }

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<FilterRequest>) {
        this.provider.select().context(event, entity);
    }

    public _ng_onDoubleClick(event: MouseEvent, entity: Entity<FilterRequest>) {
        this.provider.select().doubleclick(event, entity);
    }

    public _ng_viablePredicate(): () => boolean {
        return this.provider.isViable.bind(this);
    }

    private _onDataUpdate() {
        this._ng_entries = this.provider.get();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

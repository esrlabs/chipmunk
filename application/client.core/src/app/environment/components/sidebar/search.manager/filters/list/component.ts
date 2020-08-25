import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input } from '@angular/core';
import { FilterRequest } from '../../../../../controller/controller.session.tab.search.filters.request';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

import SearchManagerService, { EListID } from '../../service/service';

@Component({
    selector: 'app-sidebar-app-searchmanager-filters',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppSearchManagerFiltersComponent implements OnDestroy, AfterContentInit {

    @Input() provider: Provider<FilterRequest>;

    public _ng_entries: Array<Entity<FilterRequest>> = [];
    public _ng_listID: EListID = EListID.filtersList;
    public _ng_dragging: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _droppedOut: boolean;
    private _ignore: boolean;

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
        this._subscriptions.mouseOver = SearchManagerService.getObservable().mouseOver.subscribe(this._onMouseOver.bind(this));
        this._subscriptions.mouseOverGlobal = SearchManagerService.getObservable().mouseOverGlobal.subscribe(this._onMouseOverGlobal.bind(this));
    }

    public _ng_onItemDragged(event: CdkDragDrop<FilterRequest[]>) {
        SearchManagerService.onDragStart(false);
        this._ng_dragging = false;
        if (this._droppedOut) {
            return;
        }
        const prev = event.previousContainer;
        const index = event.previousIndex;
        if (prev.data !== undefined && (prev.data as any).disabled !== undefined) {
            const outside: Entity<any> | undefined = (prev.data as any).disabled[event.previousIndex] !== undefined ? (prev.data as any).disabled[index] : undefined;
            if (outside !== undefined && typeof outside.getEntity().getEntity === 'function' && outside.getEntity().getEntity() instanceof FilterRequest) {
                this.provider.getSession().getSessionSearch().getDisabledAPI().getStorage().remove(outside.getEntity());
                this.provider.getSession().getSessionSearch().getFiltersAPI().getStorage().add(outside.getEntity().getEntity(), event.currentIndex);
            }
        } else {
            this.provider.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        }
    }

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<FilterRequest>) {
        this.provider.select().context(event, entity);
    }

    public _ng_onDoubleClick(event: MouseEvent, entity: Entity<FilterRequest>) {
        this.provider.select().doubleclick(event, entity);
    }

    public _ng_onDragStarted(entity: Entity<FilterRequest>) {
        this._ng_dragging = true;
        SearchManagerService.onDragStart(true, entity);
    }

    private _onMouseOver(listID: EListID) {
        this._ignore = true;
        this._droppedOut = false;
    }

    private _onMouseOverGlobal() {
        if (!this._ignore) {
            this._droppedOut = true;
        } else {
            this._ignore = false;
        }
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

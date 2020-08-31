import { Component, OnDestroy, AfterContentInit, Input } from '@angular/core';
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

export class SidebarAppSearchManagerFiltersPlaceholderComponent implements OnDestroy, AfterContentInit {

    @Input() provider: Provider<FilterRequest>;

    public _ng_listID: EListID = EListID.filtersList;
    public _ng_empty = 'No filters are stored';

    private _subscriptions: { [key: string]: Subscription } = {};
    private _droppedOut: boolean;
    private _ignore: boolean;

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.mouseOver = SearchManagerService.observable.mouseOver.subscribe(this._onMouseOver.bind(this));
        this._subscriptions.mouseOverGlobal = SearchManagerService.observable.mouseOverGlobal.subscribe(this._onMouseOverGlobal.bind(this));
    }

    public _ng_onItemDragged(event: CdkDragDrop<FilterRequest[]>) {
        SearchManagerService.onDragStart(false);
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

}

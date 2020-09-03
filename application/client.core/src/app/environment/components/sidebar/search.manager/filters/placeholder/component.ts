import { Component, OnDestroy, Input, ViewChild } from '@angular/core';
import { FilterRequest } from '../../../../../controller/controller.session.tab.search.filters.request';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { SidebarAppSearchManagerListDirective } from '../../directives/list.directive';
import SearchManagerService, { EListID, TRequest } from '../../service/service';
import { Entity } from '../../providers/entity';

@Component({
    selector: 'app-sidebar-app-searchmanager-filters',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppSearchManagerFiltersPlaceholderComponent implements OnDestroy {

    @Input() provider: Provider<FilterRequest>;

    @ViewChild(SidebarAppSearchManagerListDirective) listDirective: SidebarAppSearchManagerListDirective;

    public _ng_listID: EListID = EListID.filtersList;
    public _ng_empty = 'No filters are stored';

    private _subscriptions: { [key: string]: Subscription } = {};

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onItemDragged(event: CdkDragDrop<Entity<TRequest>[]>) {
        SearchManagerService.onDragStart(false);
        if (this.listDirective.droppedOut) {
            return;
        }
        this.provider.itemDragged(event);
    }

}

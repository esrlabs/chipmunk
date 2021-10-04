import { Component, OnDestroy, Input } from '@angular/core';
import { FilterRequest } from '../../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import SearchManagerService, { TRequest } from '../../service/service';
import { EntityData } from '../../providers/entity.data';

@Component({
    selector: 'app-sidebar-app-searchmanager-filters',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppSearchManagerFiltersPlaceholderComponent implements OnDestroy {
    @Input() provider!: Provider<FilterRequest>;

    public _ng_empty = 'No filters are stored';

    private _subscriptions: { [key: string]: Subscription } = {};

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onItemDragged(event: CdkDragDrop<any>) {
        SearchManagerService.onDragStart(false);
        if (SearchManagerService.droppedOut) {
            return;
        }
        this.provider.itemDragged(event);
    }
}

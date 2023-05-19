import { Component } from '@angular/core';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ProviderFilters } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { EntitiesList, ListId } from '../../base/list';

@Component({
    selector: 'app-sidebar-filters-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: [EntitiesList.HOST_DIRECTIVE],
})
@Initial()
@Ilc()
export class FiltersList extends EntitiesList<ProviderFilters, FilterRequest> {
    protected getListId(): ListId {
        return ListId.Filters;
    }
}
export interface FiltersList extends IlcInterface {}

import { Component } from '@angular/core';
import { ProviderFilters } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { EntitiesList, ListId } from '../../base/list';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';

@Component({
    selector: 'app-sidebar-filters-placeholder',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: [EntitiesList.HOST_DIRECTIVE],
})
@Initial()
@Ilc()
export class FiltersPlaceholder extends EntitiesList<ProviderFilters, FilterRequest> {
    protected getListId(): ListId {
        return ListId.Filters;
    }
}
export interface FiltersPlaceholder extends IlcInterface {}

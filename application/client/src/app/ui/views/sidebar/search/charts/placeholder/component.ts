import { Component } from '@angular/core';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ProviderCharts } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { EntitiesList, ListId } from '../../base/list';

@Component({
    selector: 'app-sidebar-charts-placeholder',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: [EntitiesList.HOST_DIRECTIVE],
})
@Initial()
@Ilc()
export class ChartsPlaceholder extends EntitiesList<ProviderCharts, ChartRequest> {
    protected getListId(): ListId {
        return ListId.Charts;
    }
}
export interface ChartsPlaceholder extends IlcInterface {}

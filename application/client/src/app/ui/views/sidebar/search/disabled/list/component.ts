import { Component, AfterContentInit } from '@angular/core';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ProviderDisabled } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { EntitiesList, ListId } from '../../base/list';

@Component({
    selector: 'app-sidebar-disabled-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: [EntitiesList.HOST_DIRECTIVE],
})
@Initial()
@Ilc()
export class DisabledList
    extends EntitiesList<ProviderDisabled, DisabledRequest>
    implements AfterContentInit
{
    protected getListId(): ListId {
        return ListId.Disabled;
    }
}
export interface DisabledList extends IlcInterface {}

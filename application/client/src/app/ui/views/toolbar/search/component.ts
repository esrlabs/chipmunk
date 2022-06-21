import { Component, Input } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Service } from '@elements/scrollarea/controllers/service';
import { Columns } from '@schema/render/columns';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewSearch {
    @Input() public session!: Session;

    public service!: Service;
    public columns: Columns | undefined;
}
export interface ViewSearch extends IlcInterface {}

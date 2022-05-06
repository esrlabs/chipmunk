import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterContentInit,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Service } from '@elements/scrollarea/controllers/service';
import { Subscriber } from '@platform/env/subscription';
import { Columns } from '@schema/render/columns';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewSearch implements AfterContentInit, OnDestroy {
    @Input() public session!: Session;

    private readonly _subscriber: Subscriber = new Subscriber();

    public service!: Service;
    public columns: Columns | undefined;

    public ngOnDestroy(): void {
        this._subscriber.unsubscribe();
    }

    public ngAfterContentInit(): void {}
}
export interface ViewSearch extends IlcInterface {}

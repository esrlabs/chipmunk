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
import { ScrollAreaComponent, IScrollBoxSelection } from '@elements/scrollarea/component';
import { Service } from '@elements/scrollarea/controllers/service';
import { Subscriber } from '@platform/env/subscription';
import { Columns } from '@schema/render/columns';
import { getScrollAreaService, setScrollAreaService } from './backing';

@Component({
    selector: 'app-views-search-results',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.Default,
})
@Ilc()
export class ViewSearchResults implements AfterContentInit, OnDestroy {
    @ViewChild(ScrollAreaComponent) scrollAreaComponent!: ScrollAreaComponent;

    @Input() public session!: Session;

    public service!: Service;
    public columns: Columns | undefined;

    public ngOnDestroy(): void {
        setScrollAreaService(this.session, this.service);
    }

    public ngAfterContentInit(): void {
        this.ilc().channel.session.search.updated((event) => {
            if (event.session !== this.session.uuid()) {
                return;
            }
            this.service.setLen(event.len);
        });
        this.service = getScrollAreaService(this.session);
        const bound = this.session.render.getBoundEntity();
        this.columns = bound instanceof Columns ? bound : undefined;
    }
}
export interface ViewSearchResults extends IlcInterface {}

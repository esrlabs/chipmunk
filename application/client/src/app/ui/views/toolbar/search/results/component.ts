import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterContentInit,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Session } from '@service/session';
import { Owner } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ScrollAreaComponent } from '@elements/scrollarea/component';
import { Service } from '@elements/scrollarea/controllers/service';
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
        this.env().subscriber.register(
            this.session.search.subjects.get().updated.subscribe((len: number) => {
                this.service.setLen(len);
            }),
        );
        this.env().subscriber.register(
            this.session.bookmarks.subjects.get().updated.subscribe(() => {
                this.service.refresh();
            }),
        );
        this.env().subscriber.register(
            this.session.cursor.subjects.get().selected.subscribe((event) => {
                if (event.initiator === Owner.Search) {
                    return;
                }
                console.log(`Isn't implemented yet`);
            }),
        );
        this.service = getScrollAreaService(this.session);
        const bound = this.session.render.getBoundEntity();
        this.columns = bound instanceof Columns ? bound : undefined;
    }
}
export interface ViewSearchResults extends IlcInterface {}

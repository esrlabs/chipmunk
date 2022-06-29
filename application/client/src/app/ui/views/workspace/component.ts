import { Component, OnDestroy, ViewChild, Input, AfterContentInit } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ScrollAreaComponent } from '@elements/scrollarea/component';
import { Service } from '@elements/scrollarea/controllers/service';
import { getScrollAreaService, setScrollAreaService } from './backing';
import { Columns } from '@schema/render/columns';
import { Owner } from '@schema/content/row';

@Component({
    selector: 'app-views-workspace',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewWorkspace implements AfterContentInit, OnDestroy {
    @ViewChild(ScrollAreaComponent) scrollAreaComponent!: ScrollAreaComponent;

    @Input() public session!: Session;

    public service!: Service;
    public columns: Columns | undefined;

    public ngOnDestroy(): void {
        setScrollAreaService(this.session, this.service);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.stream.subjects.get().updated.subscribe((len: number) => {
                this.service.setLen(len);
            }),
        );
        this.env().subscriber.register(
            this.session.cursor.subjects.get().selected.subscribe((event) => {
                if (event.initiator === Owner.Output) {
                    return;
                }
                this.service.scrollTo(event.row);
            }),
        );
        this.service = getScrollAreaService(this.session);
        const bound = this.session.render.getBoundEntity();
        this.columns = bound instanceof Columns ? bound : undefined;
    }
}
export interface ViewWorkspace extends IlcInterface {}

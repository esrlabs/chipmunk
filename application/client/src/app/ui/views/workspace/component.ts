import { Component, OnDestroy, ViewChild, Input, AfterContentInit } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ScrollAreaComponent } from '@elements/scrollarea/component';
import { Service } from '@elements/scrollarea/controllers/service';
import { getScrollAreaService, setScrollAreaService } from './backing';
import { Columns } from '@schema/render/columns';

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
        this.ilc().channel.session.stream.updated((event) => {
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
export interface ViewWorkspace extends IlcInterface {}

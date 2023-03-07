import { Component, OnDestroy, ViewChild, Input, AfterContentInit } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ScrollAreaComponent } from '@elements/scrollarea/component';
import { Service } from '@elements/scrollarea/controllers/service';
import { getScrollAreaService, setScrollAreaService } from './backing';
import { Columns } from '@schema/render/columns';
import { Owner } from '@schema/content/row';
import { ColumnsHeaders } from './headers/component';

@Component({
    selector: 'app-views-workspace',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewWorkspace implements AfterContentInit, OnDestroy {
    @ViewChild(ScrollAreaComponent) scrollAreaComponent!: ScrollAreaComponent;
    @ViewChild('headers') headers!: ColumnsHeaders;

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
        this.env().subscriber.register(
            this.service.onBound(() => {
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen('Ctrl + 1', () => {
                        this.service.focus().set();
                    }),
                );
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + W', () => {
                this.session.close();
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + F', () => {
                this.session.switch().toolbar.search();
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Shift + Ctrl + P', () => {
                this.session.switch().toolbar.presets();
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + 2', () => {
                this.session.switch().toolbar.search();
            }),
        );
        const bound = this.session.render.getBoundEntity();
        this.columns = bound instanceof Columns ? bound : undefined;
    }

    public onHorizontalScrolling(offset: number): void {
        if (this.headers === undefined || this.headers === null) {
            return;
        }
        this.headers.setOffset(offset);
    }

    protected move(): {
        top(): void;
        bottom(): void;
    } {
        return {
            top: (): void => {
                this.service.getLen() > 0 && this.service.focus().get() && this.service.scrollTo(0);
            },
            bottom: (): void => {
                this.service.getLen() > 0 &&
                    this.service.focus().get() &&
                    this.service.scrollTo(this.service.getLen());
            },
        };
    }
}
export interface ViewWorkspace extends IlcInterface {}

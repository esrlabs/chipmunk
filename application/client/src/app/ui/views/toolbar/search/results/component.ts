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

    protected navigation: {
        pending: number;
    } = {
        pending: -1,
    };

    public ngOnDestroy(): void {
        setScrollAreaService(this.session, this.service);
    }

    public ngAfterContentInit(): void {
        this.service = getScrollAreaService(this.session);
        this.env().subscriber.register(
            this.session.search.map.updated.subscribe((_event) => {
                this.service.setLen(this.session.search.map.len());
                const single = this.session.cursor.getSingle().position();
                if (this.session.search.len() > 0 && single !== undefined) {
                    // if (event.initiator === Owner.Search || single === undefined) {
                    this.session.search
                        .nearest(single)
                        .then((location) => {
                            this.service.scrollTo(
                                location.position - 2 < 0 ? 0 : location.position - 2,
                            );
                            this.service.refresh();
                        })
                        .catch((err: Error) => {
                            console.error(err);
                        });
                } else {
                    this.service.refresh();
                }
            }),
        );
        this.env().subscriber.register(
            this.service.onBound(() => {
                this.env().subscriber.register(
                    this.service.getFrame().onFrameChange(() => {
                        if (this.navigation.pending === -1) {
                            return;
                        }
                        const frame = this.service.getFrame();
                        const pending = frame
                            .getRows()
                            .find((r) => r.position === this.navigation.pending);
                        if (pending === undefined) {
                            return;
                        }
                        this.navigation.pending = -1;
                        this.session.cursor.select(pending.position, Owner.Search);
                    }),
                );
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen(']', () => {
                        this.move().next();
                    }),
                );
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen('[', () => {
                        this.move().prev();
                    }),
                );
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen('gg', () => {
                        this.move().top();
                    }),
                );
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen('g', () => {
                        this.move().bottom();
                    }),
                );
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen('Ctrl + 2', () => {
                        this.service.focus().set();
                    }),
                );
            }),
        );
        const bound = this.session.render.getBoundEntity();
        this.columns = bound instanceof Columns ? bound : undefined;
    }

    protected move(): {
        next(): void;
        prev(): void;
        top(): void;
        bottom(): void;
    } {
        const frame = this.service.getFrame();
        const rows = frame.getRows();
        const selected = (() => {
            if (this.session.search.len() === 0) {
                return undefined;
            }
            if (rows.length === 0) {
                return undefined;
            }
            const single = this.session.cursor.getSingle().position();
            if (single === undefined) {
                this.session.cursor.select(rows[0].position, Owner.Search);
                return undefined;
            }
            const selected = rows.findIndex((r) => r.position === single);
            return selected !== -1 ? selected : undefined;
        })();
        return {
            next: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (selected < rows.length - 1) {
                    this.session.cursor.select(rows[selected + 1].position, Owner.Search);
                    return;
                }
                if (selected === rows.length - 1) {
                    const last = rows[rows.length - 1];
                    if (last.position === this.service.getLen() - 1) {
                        // Last match
                        return;
                    }
                    const target = rows[1];
                    if (target !== undefined) {
                        this.navigation.pending = last.position + 1;
                        this.service.scrollTo(target.position);
                    }
                    return;
                }
            },
            prev: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (selected > 0) {
                    this.session.cursor.select(rows[selected - 1].position, Owner.Search);
                    return;
                }
                if (selected === 0) {
                    const first = rows[0];
                    if (first.position === 0) {
                        // First match
                        return;
                    }
                    this.navigation.pending = first.position - 1;
                    this.service.scrollTo(this.navigation.pending);
                    return;
                }
            },
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
export interface ViewSearchResults extends IlcInterface {}

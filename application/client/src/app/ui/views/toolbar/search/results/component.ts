import { Component, OnDestroy, ViewChild, Input, AfterContentInit } from '@angular/core';
import { Session } from '@service/session';
import { Owner } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ScrollAreaComponent } from '@elements/scrollarea/component';
import { Service } from '@elements/scrollarea/controllers/service';
import { Columns } from '@schema/render/columns';
import { getScrollAreaService, setScrollAreaService } from './backing';

enum PendingScroll {
    Prev,
    Next,
    Unset,
}

@Component({
    selector: 'app-views-search-results',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class ViewSearchResults implements AfterContentInit, OnDestroy {
    @ViewChild(ScrollAreaComponent) scrollAreaComponent!: ScrollAreaComponent;

    @Input() public session!: Session;

    public service!: Service;
    public columns: Columns | undefined;

    protected navigation: {
        pending: PendingScroll;
    } = {
        pending: PendingScroll.Unset,
    };

    public ngOnDestroy(): void {
        setScrollAreaService(this.session, this.service);
    }

    public ngAfterContentInit(): void {
        this.service = getScrollAreaService(this.session);
        this.env().subscriber.register(
            this.session.cursor.subjects.get().selected.subscribe((event) => {
                if (this.session.search.len() === 0) {
                    return;
                }
                const single = this.session.cursor.getSingle().position();
                if (event.initiator === Owner.Search && single !== undefined) {
                    this.session.search
                        .nearest(single)
                        .then((location) => {
                            location !== undefined &&
                                this.session.search.state().nested().setFrom(location.index);
                        })
                        .catch((err: Error) => {
                            this.log().error(`Fail to get nearest content: ${err.message}`);
                        });
                    return;
                } else if (single !== undefined) {
                    this.session.search
                        .nearest(single)
                        .then((location) => {
                            if (location === undefined) {
                                return;
                            }
                            this.service.scrollTo(location.index - 2 < 0 ? 0 : location.index - 2);
                            this.service.refresh();
                        })
                        .catch((err: Error) => {
                            this.log().error(`Fail to get nearest content: ${err.message}`);
                        });
                }
            }),
            this.session.indexed.subjects.get().updated.subscribe((len: number) => {
                this.service.setLen(len);
            }),
            this.session.indexed.subjects.get().changed.subscribe(() => {
                this.service.refresh();
            }),
            this.service.onBound(() => {
                this.env().subscriber.register(
                    this.service.getFrame().onFrameChange(() => {
                        if (this.navigation.pending === PendingScroll.Unset) {
                            return;
                        }
                        const rows = this.service.getFrame().getRows();
                        if (rows.length === 0) {
                            return;
                        }
                        this.session.cursor.select(
                            this.navigation.pending === PendingScroll.Next
                                ? rows[rows.length - 1].position
                                : rows[0].position,
                            Owner.Search,
                            undefined,
                            undefined,
                        );
                        this.navigation.pending = PendingScroll.Unset;
                    }),
                    this.ilc().services.system.hotkeys.listen(']', () => {
                        if (this.session.search.state().nested().get() !== undefined) {
                            return;
                        }
                        this.move().next();
                    }),
                    this.ilc().services.system.hotkeys.listen('[', () => {
                        if (this.session.search.state().nested().get() !== undefined) {
                            return;
                        }
                        this.move().prev();
                    }),
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
        const range = frame.get();
        const selected = (() => {
            if (this.session.indexed.len() === 0) {
                return undefined;
            }
            if (rows.length === 0) {
                return undefined;
            }
            const single = this.session.cursor.getSingle().position();
            if (single === undefined) {
                this.session.cursor.select(rows[0].position, Owner.Search, undefined, undefined);
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
                    this.session.cursor.select(
                        rows[selected + 1].position,
                        Owner.Search,
                        undefined,
                        undefined,
                    );
                    return;
                }
                if (
                    range.start + 1 >= this.service.getLen() - 1 ||
                    range.end >= this.service.getLen() - 1
                ) {
                    return;
                }
                this.navigation.pending = PendingScroll.Next;
                this.service.scrollTo(range.start + 1);
            },
            prev: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (rows[selected] === undefined) {
                    return;
                }
                if (selected >= 1) {
                    this.session.cursor.select(
                        rows[selected - 1].position,
                        Owner.Search,
                        undefined,
                        undefined,
                    );
                    return;
                }
                if (range.start === 0) {
                    return;
                }
                this.navigation.pending = PendingScroll.Prev;
                this.service.scrollTo(range.start - 1);
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

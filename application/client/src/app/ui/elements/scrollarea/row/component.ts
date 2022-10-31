import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    HostListener,
    HostBinding,
    ChangeDetectionStrategy,
    SkipSelf,
} from '@angular/core';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Locker, Level } from '@ui/service/lockers';
import { getSourceColor } from '@ui/styles/colors';

@Component({
    selector: 'app-scrollarea-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class RowComponent extends ChangesDetector implements AfterContentInit, AfterViewInit {
    @Input() public row!: Row;

    public render: number = 1;
    public bookmarked: boolean = false;
    public selected: boolean = false;
    public source: {
        color: string | undefined;
    } = {
        color: undefined,
    };

    @HostBinding('attr.data-selected') get dataSelectedAttr() {
        return this.selected;
    }
    @HostListener('mouseover') onMouseIn() {
        this.ilc().emitter.ui.row.hover(this.row);
    }

    @HostListener('mouseout', ['$event.target']) onMouseOut() {
        this.ilc().emitter.ui.row.hover(undefined);
    }

    @HostListener('mouseleave', ['$event.target']) onMouseLeave() {
        this.ilc().emitter.ui.row.hover(undefined);
    }

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: {}[] = [];
        if (this.row.session.cursor.get().length > 0) {
            items.push(
                ...[
                    {
                        caption: 'Unselect All',
                        handler: () => {
                            this.row.session.cursor.drop();
                        },
                    },
                    {},
                ],
            );
        }
        items.push(
            ...[
                {
                    caption: 'Export Selected',
                    disabled: this.row.session.cursor.get().length === 0,
                    handler: () => {
                        const progress = this.ilc().services.ui.lockers.lock(
                            new Locker(true, 'exporting into file...')
                                .set()
                                .group(this.row.session.uuid())
                                .end(),
                            {
                                closable: false,
                            },
                        );
                        this.row.session.exporter
                            .export()
                            .stream()
                            .then(() => {
                                progress.popup.close();
                            })
                            .catch((err: Error) => {
                                this.log().error(`Fail to export data: ${err.message}`);
                                progress.locker
                                    .set()
                                    .message(err.message)
                                    .type(Level.error)
                                    .spinner(false);
                            });
                    },
                },
                {},
                {
                    caption: 'Export All Search Result',
                    disabled: this.row.session.search.len() === 0,
                    handler: () => {
                        const progress = this.ilc().services.ui.lockers.lock(
                            new Locker(true, 'exporting into file...')
                                .set()
                                .group(this.row.session.uuid())
                                .end(),
                            {
                                closable: false,
                            },
                        );
                        this.row.session.exporter
                            .export()
                            .search()
                            .then(() => {
                                progress.popup.close();
                            })
                            .catch((err: Error) => {
                                this.log().error(`Fail to export data: ${err.message}`);
                                progress.locker
                                    .set()
                                    .message(err.message)
                                    .type(Level.error)
                                    .spinner(false);
                            });
                    },
                },
            ],
        );
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
        });
    }

    @HostListener('click') onClick() {
        this.row.select().toggle();
    }

    constructor(@SkipSelf() selfCdRef: ChangeDetectorRef) {
        super(selfCdRef);
    }

    public ngAfterContentInit(): void {
        this.render = this.row.session.render.delimiter() === undefined ? 1 : 2;
        this.env().subscriber.register(
            this.row.session.stream.subjects.get().rank.subscribe(() => {
                this.update();
            }),
        );
        this.env().subscriber.register(
            this.row.session.stream.subjects.get().sources.subscribe(() => {
                this.update();
            }),
        );
        this.env().subscriber.register(this.row.change.subscribe(this.update.bind(this)));
        this.env().subscriber.register(
            this.row.session.bookmarks.subjects
                .get()
                .updated.subscribe(this.update.bind(this, false)),
        );
        this.env().subscriber.register(
            this.row.session.cursor.subjects.get().updated.subscribe(this.update.bind(this)),
        );
        this.update();
    }

    public ngAfterViewInit(): void {
        this.update();
    }

    public ngGetRankFiller(position: number): string {
        return this.row.session.stream.rank.getFiller(position);
    }

    public ngGetSignatureWidth(): { [key: string]: string } {
        const width = `${this.row.session.stream.rank.width()}px`;
        return {
            width: width,
            minWidth: width,
            maxWidth: width,
        };
    }

    public onNumberClick() {
        this.row.bookmark().toggle();
    }

    protected hash(): string {
        return `${this.bookmarked}.${this.selected}.${this.source.color}`;
    }

    protected update() {
        const prev = this.hash();
        this.bookmarked = this.row.bookmark().is();
        if (this.row.session.stream.observe().descriptions.count() > 1) {
            this.source.color = getSourceColor(this.row.source);
        } else {
            this.source.color = undefined;
        }
        this.selected = this.row.select().is();
        if (prev !== this.hash()) {
            this.detectChanges();
        }
    }
}
export interface RowComponent extends IlcInterface {}

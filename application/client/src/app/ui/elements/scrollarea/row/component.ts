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
import { Owner, Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Locker, Level } from '@ui/service/lockers';
import { getSourceColor } from '@ui/styles/colors';
import { Notification } from '@ui/service/notifications';
import { Selecting } from '../controllers/selection';
import { popup, Vertical, Horizontal } from '@ui/service/popup';
import { components } from '@env/decorators/initial';
import { scheme_color_1 } from '@ui/styles/colors';

@Component({
    selector: 'app-scrollarea-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class RowComponent extends ChangesDetector implements AfterContentInit, AfterViewInit {
    protected hash!: string;

    @Input() public row!: Row;
    @Input() public selecting!: Selecting;

    public render: number = 1;
    public bookmarked: boolean = false;
    public selected: boolean = false;
    public attachment:
        | {
              name: string;
              color: string;
          }
        | undefined = undefined;
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

    @HostListener('contextmenu', ['$event']) async onContextMenu(event: MouseEvent) {
        const isRawAvailable = await this.row.session.exporter.isRawAvailable();
        const confirmToUser = () => {
            this.ilc().services.ui.notifications.notify(
                new Notification({ message: 'Data has been exported into file', actions: [] }),
            );
        };
        const exportSelected = (raw: boolean) => {
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
                .export(raw)
                .stream(this.row.session.selection().ranges())
                .then((saved: boolean) => {
                    progress.popup.close();
                    saved && confirmToUser();
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to export data${raw ? ' (raw)' : ''}: ${err.message}`);
                    progress.locker.set().message(err.message).type(Level.error).spinner(false);
                });
        };
        const exportSearch = (raw: boolean) => {
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
                .export(raw)
                .search()
                .then((saved: boolean) => {
                    progress.popup.close();
                    saved && confirmToUser();
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to export data${raw ? ' (raw)' : ''}: ${err.message}`);
                    progress.locker.set().message(err.message).type(Level.error).spinner(false);
                });
        };
        const items: {}[] = [];
        const selectedRowsCount = this.row.session.selection().indexes().length;
        const delimiter = this.row.session.render.delimiter();
        const selection = this.selecting.selection();
        items.push(
            ...[
                {
                    caption:
                        delimiter === undefined
                            ? 'Copy as Plain Text'
                            : selection.lines > 1
                            ? 'Copy as Formated Table'
                            : 'Copy',
                    disabled: !selection.exist,
                    shortcut: 'Ctrl + C',
                    handler: () => {
                        this.selecting.copyToClipboard(false).catch((err: Error) => {
                            this.log().error(`Fail to copy selection: ${err.message}`);
                        });
                    },
                },
                {
                    caption:
                        delimiter === undefined
                            ? 'Copy with Original Formating'
                            : 'Copy without Formating',
                    disabled: !selection.exist || (delimiter !== undefined && selection.lines <= 1),
                    handler: () => {
                        this.selecting.copyToClipboard(true).catch((err: Error) => {
                            this.log().error(`Fail to copy selection: ${err.message}`);
                        });
                    },
                },
                {},
                {
                    caption:
                        selectedRowsCount === 0
                            ? 'Unselect All'
                            : `Unselect ${selectedRowsCount} row${
                                  selectedRowsCount > 1 ? 's' : ''
                              }`,
                    disabled: selectedRowsCount === 0,
                    handler: () => {
                        this.row.session.cursor.drop();
                    },
                },
                {},
                {
                    caption:
                        selectedRowsCount === 0
                            ? 'Export Selected'
                            : `Export ${selectedRowsCount} row${selectedRowsCount > 1 ? 's' : ''}`,
                    disabled: selectedRowsCount === 0,
                    handler: () => {
                        exportSelected(false);
                    },
                },
                {
                    caption:
                        selectedRowsCount === 0
                            ? 'Export Selected'
                            : `Export ${selectedRowsCount} row${
                                  selectedRowsCount > 1 ? 's' : ''
                              } as raw`,
                    disabled: !isRawAvailable || selectedRowsCount === 0,
                    handler: () => {
                        exportSelected(true);
                    },
                },
                ...(this.row.owner === Owner.Search
                    ? [
                          {},
                          {
                              caption: 'Export All Search Result',
                              disabled: this.row.session.indexed.len() === 0,
                              handler: () => {
                                  exportSearch(false);
                              },
                          },
                          {
                              caption: 'Export All Search Result as Raw',
                              disabled: !isRawAvailable || this.row.session.indexed.len() === 0,
                              handler: () => {
                                  exportSearch(true);
                              },
                          },
                      ]
                    : []),
            ],
        );
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
        });
    }

    @HostListener('click', ['$event']) onClick(event: PointerEvent) {
        this.row.select().toggle(event);
    }

    constructor(@SkipSelf() selfCdRef: ChangeDetectorRef, cdRef: ChangeDetectorRef) {
        super([selfCdRef, cdRef]);
    }

    public ngAfterContentInit(): void {
        this.render = this.row.session.render.delimiter() === undefined ? 1 : 2;
        this.selecting.setDelimiter(this.row.session.render.delimiter());
        this.env().subscriber.register(
            this.row.session.stream.subjects.get().rank.subscribe(() => {
                this.update();
            }),
            this.row.session.stream.subjects.get().sources.subscribe(() => {
                this.update();
            }),
            this.row.change.subscribe(this.update.bind(this)),
            this.row.session.bookmarks.subjects.get().updated.subscribe(this.update.bind(this)),
            this.row.session.cursor.subjects.get().updated.subscribe(this.update.bind(this)),
            this.row.change.subscribe(() => {
                this.markChangesForCheck();
            }),
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

    public showAttachment() {
        if (this.attachment === undefined) {
            return;
        }
        const attachment = this.row.session.attachments.getByPos(this.row.position);
        if (attachment === undefined) {
            return;
        }
        const instance = popup.open({
            component: {
                factory: components.get('app-views-attachments-preview'),
                inputs: {
                    attachment: attachment,
                    embedded: false,
                    close: () => {
                        instance.close();
                    },
                },
            },
            position: {
                vertical: Vertical.center,
                horizontal: Horizontal.center,
            },
            closeOnKey: 'Escape',
            uuid: attachment.uuid,
        });
    }

    protected update() {
        const hash = (): string => {
            return `${this.row.session.stream.rank.width()}.${this.bookmarked}.${this.selected}.${
                this.attachment
            }.${this.source.color}`;
        };
        const prev = this.hash;
        this.hash = hash();
        this.bookmarked = this.row.bookmark().is();
        if (this.row.session.stream.observe().descriptions.count() > 1) {
            this.source.color = getSourceColor(this.row.source);
        } else {
            this.source.color = undefined;
        }
        this.selected = this.row.select().is();
        const attachments = this.row.session.attachments;
        if (attachments.has(this.row.position)) {
            const attachment = attachments.getByPos(this.row.position);
            if (attachment !== undefined) {
                this.attachment = {
                    color: attachment.color === undefined ? scheme_color_1 : attachment.color,
                    name: attachment.name,
                };
            } else {
                this.attachment = undefined;
            }
        } else {
            this.attachment = undefined;
        }
        if (prev !== this.hash) {
            this.markChangesForCheck();
        }
    }
}
export interface RowComponent extends IlcInterface {}

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
    OnDestroy,
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
import { TextExportOptions } from '@platform/types/exporting';

import * as dom from '@ui/env/dom';

@Component({
    selector: 'app-scrollarea-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Ilc()
export class RowComponent
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
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
        const exportSelected = (raw: boolean, opt?: TextExportOptions) => {
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
                .export(raw, opt)
                .stream(this.row.session.selection().ranges())
                .then((filepath: string | undefined) => {
                    filepath !== undefined && confirmToUser();
                })
                .finally(() => {
                    progress.popup.close();
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to export data${raw ? ' (raw)' : ''}: ${err.message}`);
                    this.ilc().services.ui.lockers.lock(
                        new Locker(false, err.message).set().type(Level.error).end(),
                        {
                            closable: true,
                        },
                    );
                });
        };
        const exportSearch = (raw: boolean, opt?: TextExportOptions) => {
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
                .export(raw, opt)
                .search()
                .then((filepath: string | undefined) => {
                    filepath !== undefined && confirmToUser();
                })
                .finally(() => {
                    progress.popup.close();
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to export data${raw ? ' (raw)' : ''}: ${err.message}`);
                    this.ilc().services.ui.lockers.lock(
                        new Locker(false, err.message).set().type(Level.error).end(),
                        {
                            closable: true,
                        },
                    );
                });
        };
        const items: {}[] = [];
        const selectedRowsCount = this.row.session.selection().indexes().length;
        const selection = this.selecting.selection();
        const selectionInfo = this.selecting.getAsSelection();
        const ctrl = this.ilc().services.system.env.platform().darwin() ? 'Cmd' : 'Ctrl';
        items.push(
            ...[
                {
                    caption: 'Copy',
                    disabled: !selection.exist,
                    shortcut: `${ctrl} + C`,
                    handler: () => {
                        this.selecting.copyToClipboard().catch((err: Error) => {
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
                ...(this.render === 2
                    ? [
                          {
                              caption:
                                  selectedRowsCount === 0
                                      ? 'Export Selected as Table'
                                      : `Export ${selectedRowsCount} row${
                                            selectedRowsCount > 1 ? 's' : ''
                                        } as Table`,
                              disabled: selectedRowsCount === 0,
                              handler: () => {
                                  popup.open({
                                      component: {
                                          factory: components.get('app-dialogs-columns-selector'),
                                          inputs: {
                                              session: this.row.session,
                                              accept: (
                                                  columns: number[],
                                                  delimiter: string | undefined,
                                              ) => {
                                                  exportSelected(false, {
                                                      columns,
                                                      delimiter,
                                                      spliter: this.row.session.render.delimiter(),
                                                  });
                                              },
                                          },
                                      },
                                      position: {
                                          vertical: Vertical.center,
                                          horizontal: Horizontal.center,
                                      },
                                      uuid: 'Selecting columns',
                                  });
                              },
                          },
                      ]
                    : [
                          {
                              caption:
                                  selectedRowsCount === 0
                                      ? 'Export Selected'
                                      : `Export ${selectedRowsCount} row${
                                            selectedRowsCount > 1 ? 's' : ''
                                        } `,
                              disabled: selectedRowsCount === 0,
                              handler: () => {
                                  exportSelected(false);
                              },
                          },
                      ]),

                {
                    caption:
                        selectedRowsCount === 0
                            ? 'Export Selected as Raw'
                            : `Export ${selectedRowsCount} row${
                                  selectedRowsCount > 1 ? 's' : ''
                              } as Raw`,
                    disabled: !isRawAvailable || selectedRowsCount === 0,
                    handler: () => {
                        exportSelected(true);
                    },
                },
                ...(this.row.owner === Owner.Output
                    ? [
                          {
                              caption: 'Export All',
                              disabled: this.row.session.stream.len() === 0,
                              handler: () => {
                                  this.row.session.exporter
                                      .export(true)
                                      .all()
                                      .catch((err: Error) => {
                                          this.log().error(`Fail export session: ${err.message}`);
                                      });
                              },
                          },
                          {},
                          {
                              caption: 'Comment',
                              disabled:
                                  selectionInfo === undefined ||
                                  !this.row.session.comments.isCreatingAvailable(),
                              handler: () => {
                                  if (selectionInfo === undefined) {
                                      return;
                                  }
                                  this.row.session.comments
                                      .create(selectionInfo)
                                      .catch((err: Error) => {
                                          this.log().error(`Fail to add comment: ${err.message}`);
                                      });
                                  dom.stop(event);
                              },
                          },
                      ]
                    : []),
                ...(this.row.owner === Owner.Search
                    ? [
                          {},
                          ...(this.render === 2
                              ? [
                                    {
                                        caption: 'Export All Search Result As Table',
                                        disabled: this.row.session.indexed.len() === 0,
                                        handler: () => {
                                            popup.open({
                                                component: {
                                                    factory: components.get(
                                                        'app-dialogs-columns-selector',
                                                    ),
                                                    inputs: {
                                                        session: this.row.session,
                                                        accept: (
                                                            columns: number[],
                                                            delimiter: string | undefined,
                                                        ) => {
                                                            exportSearch(false, {
                                                                columns,
                                                                delimiter,
                                                                spliter:
                                                                    this.row.session.render.delimiter(),
                                                            });
                                                        },
                                                    },
                                                },
                                                position: {
                                                    vertical: Vertical.center,
                                                    horizontal: Horizontal.center,
                                                },
                                                uuid: 'Selecting columns',
                                            });
                                        },
                                    },
                                ]
                              : [
                                    {
                                        caption: 'Export All Search Result',
                                        disabled: this.row.session.indexed.len() === 0,
                                        handler: () => {
                                            exportSearch(false);
                                        },
                                    },
                                ]),
                          {
                              caption: 'Export All Search Result as Raw',
                              disabled: !isRawAvailable || this.row.session.indexed.len() === 0,
                              handler: () => {
                                  exportSearch(true);
                              },
                          },
                          {},
                          {
                              caption: 'Open Search Result as New Tab',
                              disabled: this.row.session.indexed.len() === 0,
                              handler: () => {
                                  const progress = this.ilc().services.ui.lockers.lock(
                                      new Locker(true, 'preparing new session...')
                                          .set()
                                          .group(this.row.session.uuid())
                                          .end(),
                                      {
                                          closable: false,
                                      },
                                  );
                                  this.row.session
                                      .searchResultAsNewSession()
                                      .finally(() => {
                                          progress.popup.close();
                                      })
                                      .catch((err: Error) => {
                                          this.log().error(
                                              `Fail to open search result as new session: ${err.message}`,
                                          );
                                          this.ilc().services.ui.lockers.lock(
                                              new Locker(false, err.message)
                                                  .set()
                                                  .type(Level.error)
                                                  .end(),
                                              {
                                                  closable: true,
                                              },
                                          );
                                      });
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

    public ngOnDestroy(): void {
        this.row.destroy();
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
            this.row.session.bookmarks.subjects.get().updated.subscribe(() => {
                this.bookmarked = this.row.bookmark().is();
                this.update();
            }),
            this.row.session.indexed.subjects.get().changed.subscribe(this.update.bind(this)),
            this.row.session.cursor.subjects.get().updated.subscribe(this.update.bind(this)),
            this.row.session.cursor.subjects.get().selected.subscribe(this.update.bind(this)),
            this.row.change.subscribe(() => {
                this.detectChanges();
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
        this.hash = hash();
        if (prev !== this.hash) {
            this.detectChanges();
        }
    }
}
export interface RowComponent extends IlcInterface {}

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
import { Notification } from '@ui/service/notifications';

@Component({
    selector: 'app-views-workspace',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
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
        this.service = getScrollAreaService(this.session);
        const bound = this.session.render.getBoundEntity();
        this.columns = bound instanceof Columns ? bound : undefined;
        this.env().subscriber.register(
            this.session.getTabAPI().subjects.onTitleContextMenu.subscribe((event: MouseEvent) => {
                const filename = this.session.stream.observe().getSourceFileName();
                this.ilc().emitter.ui.contextmenu.open({
                    items: [
                        {
                            caption: 'Generate CLI command',
                            disabled: !this.session.cli.isSupported(),
                            handler: async () => {
                                const command = await this.session.cli.generate();
                                if (command === undefined) {
                                    this.ilc().services.ui.notifications.notify(
                                        new Notification({
                                            message:
                                                'Fail to generate CLI command for this session',
                                            actions: [],
                                        }),
                                    );
                                } else {
                                    navigator.clipboard.writeText(command);
                                    this.ilc().services.ui.notifications.notify(
                                        new Notification({
                                            message: 'CLI command has been copied into clipboard',
                                            actions: [],
                                        }),
                                    );
                                }
                            },
                        },
                        {},
                        {
                            caption: 'Copy Path',
                            disabled: filename === undefined,
                            handler: () => {
                                if (!filename) {
                                    return;
                                }
                                this.ilc()
                                    .services.system.bridge.files()
                                    .name(filename)
                                    .then((info) => {
                                        navigator.clipboard.writeText(info.parent);
                                    })
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail get file info for ${filename}: ${err.message}`,
                                        );
                                    });
                            },
                        },
                        {
                            caption: 'Copy Full Path',
                            disabled: filename === undefined,
                            handler: () => {
                                filename && navigator.clipboard.writeText(filename);
                            },
                        },
                        {
                            caption: 'Copy File Name',
                            disabled: filename === undefined,
                            handler: () => {
                                if (!filename) {
                                    return;
                                }
                                this.ilc()
                                    .services.system.bridge.files()
                                    .name(filename)
                                    .then((info) => {
                                        navigator.clipboard.writeText(info.name);
                                    })
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail get file info for ${filename}: ${err.message}`,
                                        );
                                    });
                            },
                        },
                        {},
                        {
                            caption: 'Open Containing Folder',
                            disabled: filename === undefined,
                            handler: () => {
                                if (!filename) {
                                    return;
                                }
                                this.ilc()
                                    .services.system.bridge.files()
                                    .name(filename)
                                    .then((info) => {
                                        this.ilc()
                                            .services.system.bridge.folders()
                                            .open(info.parent)
                                            .catch((err: Error) => {
                                                this.log().error(`Fail to open: ${err.message}`);
                                            });
                                    })
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail get file info for ${filename}: ${err.message}`,
                                        );
                                    });
                            },
                        },
                        {},
                        {
                            caption: 'Close',
                            disabled: false,
                            handler: () => {
                                this.session.close();
                            },
                        },
                    ],
                    x: event.x,
                    y: event.y,
                });
            }),
            this.session.stream.subjects.get().updated.subscribe((len: number) => {
                this.service.setLen(len);
            }),
            this.session.cursor.subjects.get().selected.subscribe((event) => {
                if (event.initiator === Owner.Output) {
                    return;
                }
                this.service.scrollTo(event.row);
            }),
            this.service.onBound(() => {
                this.service.setAdhered(!this.session.stream.observe().isFileSource());
                this.env().subscriber.register(
                    this.ilc().services.system.hotkeys.listen('Ctrl + 1', () => {
                        this.service.focus().set();
                    }),
                );
            }),
            this.ilc().services.system.hotkeys.listen('Ctrl + W', () => {
                this.session.close();
            }),
            this.ilc().services.system.hotkeys.listen('Ctrl + F', () => {
                this.session.switch().toolbar.search();
            }),
            this.ilc().services.system.hotkeys.listen('/', () => {
                this.session.switch().toolbar.search();
            }),
            this.ilc().services.system.hotkeys.listen('Shift + Ctrl + P', () => {
                this.session.switch().toolbar.presets();
            }),
            this.ilc().services.system.hotkeys.listen('Ctrl + 2', () => {
                this.session.switch().toolbar.search();
            }),
        );
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

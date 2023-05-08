import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChild,
    ChangeDetectionStrategy,
    HostListener,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Attachment } from '@platform/types/content';
import { Wrapped } from './attachment/wrapper';
import { Locker } from '@ui/service/lockers';
import { Notification } from '@ui/service/notifications';
import { Owner } from '@schema/content/row';
import { Preview } from './preview/component';
import { NormalizedBackgroundTask } from '@platform/env/normalized';
import { IMenuItem } from '@ui/service/contextmenu';

import * as dom from '@ui/env/dom';

const UNTYPED = 'untyped';

@Component({
    selector: 'app-views-attachments-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class Attachments extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;
    @ViewChild('previewref') previewElRef!: Preview;

    public preview: Attachment | undefined;
    public extensions: Map<string, number> = new Map();
    public readonly filtered: {
        ext: string | undefined;
        attachments: Wrapped[];
    } = {
        ext: undefined,
        attachments: [],
    };

    protected readonly runner: NormalizedBackgroundTask = new NormalizedBackgroundTask(20);
    protected readonly attachments: Wrapped[] = [];
    protected readonly selection: {
        last: number;
    } = {
        last: -1,
    };
    protected readonly holded: {
        ctrl: boolean;
        shift: boolean;
    } = {
        ctrl: false,
        shift: false,
    };

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        this.ilc().emitter.ui.contextmenu.open({
            items: this.getCommonContextMenu(),
            x: event.x,
            y: event.y,
        });
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.attachments.subjects.get().updated.subscribe(this.update.bind(this)),
        );
        this.env().subscriber.register(
            this.ilc().services.ui.listener.listen<Event>('focus', window, (_event: Event) => {
                this.holded.ctrl = false;
                this.holded.shift = false;
                return true;
            }),
            this.ilc().services.ui.listener.listen<Event>('blur', window, (_event: Event) => {
                this.holded.ctrl = false;
                this.holded.shift = false;
                return true;
            }),
            this.ilc().services.ui.listener.listen<KeyboardEvent>(
                'keyup',
                window,
                (event: KeyboardEvent) => {
                    if (event.key === 'Control' || event.key === 'Meta') {
                        this.holded.ctrl = false;
                    } else if (event.key === 'Shift') {
                        this.holded.shift = false;
                    }
                    return true;
                },
            ),
        );
        this.env().subscriber.register(
            this.ilc().services.ui.listener.listen<KeyboardEvent>(
                'keydown',
                window,
                (event: KeyboardEvent) => {
                    if (event.key === 'Control' || event.key === 'Meta') {
                        this.holded.ctrl = true;
                    } else if (event.key === 'Shift') {
                        this.holded.shift = true;
                    }
                    return true;
                },
            ),
        );
        this.update();
    }

    public onItemContextMenu(event: MouseEvent, attachment: Attachment) {
        const items = [
            {
                caption: 'Select All',
                handler: () => {
                    this.attachments.map((a) => a.select());
                    this.detectChanges();
                },
            },
            {
                caption: 'Revert selection',
                handler: () => {
                    this.attachments.map((a) => a.toggle());
                    this.detectChanges();
                },
            },
            {},
            {
                caption: 'Save Selected',
                handler: () => {
                    this.save().selected();
                },
            },
            {
                caption: 'Save All',
                handler: () => {
                    this.save().all();
                },
            },
            {},
            {
                caption: 'Save As',
                handler: () => {
                    this.save().as(attachment);
                },
            },
            {},
            {
                caption: 'GoTo Related Row',
                handler: () => {
                    if (attachment.messages.length === 0) {
                        this.log().warn(
                            `Attachment ${attachment.name} isn't bound with any row(s)`,
                        );
                        return;
                    }
                    this.session.cursor.select(
                        attachment.messages[0],
                        Owner.Attachment,
                        undefined,
                        undefined,
                    );
                },
            },
            {
                caption: 'Select Related Row(s)',
                handler: () => {
                    if (attachment.messages.length === 0) {
                        this.log().warn(
                            `Attachment ${attachment.name} isn't bound with any row(s)`,
                        );
                        return;
                    }
                    const cursor = this.session.cursor;
                    cursor
                        .drop()
                        .select(attachment.messages[0], Owner.Attachment, undefined, undefined);
                    attachment.messages.forEach((pos) => cursor.mark(pos).selected());
                },
            },
            {},
            ...this.getCommonContextMenu(),
        ];
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
        });
        dom.stop(event);
    }

    public select(): {
        attachment(attachment: Attachment): void;
        drop(): void;
    } {
        return {
            attachment: (attachment: Attachment): void => {
                const target = this.attachments.find((a) => a.equal(attachment));
                if (target === undefined) {
                    return;
                }
                if (!this.holded.ctrl && !this.holded.shift) {
                    const selected = target.selected;
                    this.attachments.map((a) => a.unselect());
                    !selected && target.select();
                } else if (this.holded.ctrl) {
                    target.toggle();
                } else if (this.holded.shift) {
                    if (this.selection.last === -1) {
                        return;
                    }
                    const index = this.attachments.findIndex((a) => a.equal(attachment));
                    if (index === -1) {
                        return;
                    }
                    if (index === this.selection.last) {
                        target.toggle();
                    } else if (index > this.selection.last) {
                        for (let i = this.selection.last + 1; i <= index; i += 1) {
                            this.attachments[i].toggle();
                        }
                    } else if (index < this.selection.last) {
                        for (let i = this.selection.last - 1; i >= index; i -= 1) {
                            this.attachments[i].toggle();
                        }
                    }
                }
                const selected = this.getSelected();
                if (selected.length === 1) {
                    this.preview = selected[0];
                    if (this.previewElRef !== undefined) {
                        this.previewElRef.assign(this.preview);
                    }
                } else {
                    this.preview = undefined;
                }
                if (selected.length > 0) {
                    this.selection.last = this.attachments.findIndex((a) => a.equal(attachment));
                } else {
                    this.selection.last = -1;
                }
                this.detectChanges();
            },
            drop: (): void => {
                this.attachments.map((a) => a.unselect());
                this.preview = undefined;
            },
        };
    }

    public getSelected(): Attachment[] {
        return this.attachments.filter((a) => a.selected).map((a) => a.attachment);
    }

    public filter(): {
        ext(ext: string): void;
        update(): void;
        all(): void;
    } {
        return {
            ext: (ext: string): void => {
                this.filtered.ext = ext === UNTYPED ? '' : ext;
                this.select().drop();
                this.filter().update();
            },
            update: (): void => {
                const ext = this.filtered.ext;
                if (ext === undefined) {
                    this.filtered.attachments = this.attachments;
                } else {
                    this.filtered.attachments = this.attachments.filter((a) => a.ext(ext));
                }
                this.detectChanges();
            },
            all: (): void => {
                this.filtered.ext = undefined;
                this.select().drop();
                this.filter().update();
            },
        };
    }

    public save(): {
        all(): Promise<void>;
        selected(): Promise<void>;
        typed(ext: string): Promise<void>;
        as(attachment?: Attachment): Promise<void>;
    } {
        const bridge = this.ilc().services.system.bridge;
        const copy = async (files: string[]) => {
            if (files.length === 0) {
                return;
            }
            const folders = await bridge.folders().select();
            if (folders.length !== 1) {
                return;
            }
            const message = this.ilc().services.ui.lockers.lock(new Locker(true, `Saving...`), {
                closable: false,
            });
            bridge
                .files()
                .copy(files, folders[0])
                .catch((err: Error) => {
                    this.ilc().services.ui.notifications.notify(
                        new Notification({
                            message: err.message,
                            actions: [],
                        }),
                    );
                })
                .finally(() => {
                    message.popup.close();
                });
        };
        return {
            all: async (): Promise<void> => {
                copy(this.attachments.map((a) => a.attachment.filepath));
            },
            selected: async (): Promise<void> => {
                copy(this.attachments.filter((a) => a.selected).map((a) => a.attachment.filepath));
            },
            typed: async (ext: string): Promise<void> => {
                copy(this.attachments.filter((a) => a.ext(ext)).map((a) => a.attachment.filepath));
            },
            as: async (attachment?: Attachment): Promise<void> => {
                if (attachment === undefined) {
                    const selected = this.getSelected();
                    if (selected.length !== 1) {
                        return;
                    }
                    attachment = selected[0];
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return;
                }
                const message = this.ilc().services.ui.lockers.lock(new Locker(true, `Saving...`), {
                    closable: false,
                });
                bridge
                    .files()
                    .cp(attachment.filepath, dest)
                    .catch((err: Error) => {
                        this.ilc().services.ui.notifications.notify(
                            new Notification({
                                message: err.message,
                                actions: [],
                            }),
                        );
                    })
                    .finally(() => {
                        message.popup.close();
                    });
            },
        };
    }

    protected getCommonContextMenu(): IMenuItem[] {
        return [
            {
                caption: `Show All (${this.attachments.length})`,
                handler: () => {
                    this.filter().all();
                },
            },
            {},
            ...Array.from(this.extensions.entries()).map((entry) => {
                const ext = entry[0];
                const count = entry[1];
                return ext === UNTYPED
                    ? {
                          caption: `Show All Untyped (${count})`,
                          handler: () => {
                              this.filter().ext('');
                          },
                      }
                    : {
                          caption: `Show: *.${ext} (${count})`,
                          handler: () => {
                              this.filter().ext(ext);
                          },
                      };
            }),
        ];
    }

    protected update(): void {
        const attachments = Array.from(this.session.attachments.attachments.values()).filter(
            (a) => this.attachments.find((w) => w.equal(a)) === undefined,
        );
        this.attachments.push(...attachments.map((a) => new Wrapped(a)));
        attachments.forEach((attachment) => {
            const ext = typeof attachment.ext !== 'string' ? UNTYPED : attachment.ext;
            const count = this.extensions.get(ext);
            if (count === undefined) {
                this.extensions.set(ext, 1);
            } else {
                this.extensions.set(ext, count + 1);
            }
        });
        this.filter().update();
        this.detectChanges();
    }
}
export interface Attachments extends IlcInterface {}

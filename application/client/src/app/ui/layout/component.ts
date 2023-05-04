import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    HostBinding,
    NgZone,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Direction } from '@directives/resizer';
import { Base } from '@service/session';
import { Subject } from '@platform/env/subscription';
import { File } from '@platform/types/files';
import { Action as FileAnyAction } from '@service/actions/file.any';

const TOOLBAR_NORMAL_HEIGHT = 250;
const SIDEBAR_NORMAL_WIDTH = 350;
const TOOLBAR_MIN_HEIGHT = 50;
const SIDEBAR_MIN_WIDTH = 50;
const TOOLBAR_MAX_SIZE_RATE = 0.8;
const SIDEBAR_MAX_SIZE_RATE = 0.8;

function initialToolbarHeight(): LimittedValue {
    return new LimittedValue('toolbar.height', TOOLBAR_MIN_HEIGHT, -1, TOOLBAR_NORMAL_HEIGHT);
}

function initialSidebarWidth(): LimittedValue {
    return new LimittedValue('sidebar.width', SIDEBAR_MIN_WIDTH, -1, SIDEBAR_NORMAL_WIDTH);
}

@Component({
    selector: 'app-layout',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Layout extends ChangesDetector implements AfterViewInit {
    public readonly Direction = Direction;

    @HostBinding('class') get cssClass() {
        return this.ilc().services.ui.popup.getCount() > 0 ? 'blur' : '';
    }

    public toolbar: LimittedValue = initialToolbarHeight();
    public sidebar: LimittedValue = initialSidebarWidth();
    public session: Base | undefined;
    public resizes: {
        toolbar: Subject<number>;
        sidebar: Subject<number>;
    } = {
        toolbar: new Subject<number>(),
        sidebar: new Subject<number>(),
    };

    private _layout: DOMRect | undefined;

    private readonly _sessions: Map<string, { toolbar: number; sidebar: number }> = new Map();

    constructor(cdRef: ChangeDetectorRef, private ngZone: NgZone) {
        super(cdRef);
        this.ilc().channel.session.change(this._onSessionChange.bind(this));
        this.ilc().channel.session.closed(this._onSessionClosed.bind(this));
    }

    public ngAfterViewInit(): void {
        this._onSessionChange();
        this.ilc().channel.ui.popup.updated(() => {
            this.ngZone.run(() => {
                this.detectChanges();
            });
        });
        this.ilc().channel.ui.toolbar.occupy(() => {
            this.ngZone.run(() => {
                this.toggle().occupy();
            });
        });
        this.ilc().channel.ui.toolbar.state(
            (
                getter: (state: {
                    min: boolean;
                    max: boolean;
                    occupied: boolean;
                    size: number;
                }) => void,
            ) => {
                getter({
                    min: this.toolbar.is().min(),
                    max: this.toolbar.is().max(),
                    occupied: this.toolbar.is().max(),
                    size: this.toolbar.value,
                });
            },
        );
        this.ilc().channel.ui.toolbar.min(() => {
            this.ngZone.run(() => {
                this.set().toolbar().min();
            });
        });
        this.ilc().channel.ui.toolbar.max(() => {
            this.ngZone.run(() => {
                this.set().toolbar().max();
            });
        });
        this.ilc().channel.ui.sidebar.min(() => {
            this.ngZone.run(() => {
                this.set().sidebar().min();
            });
        });
        this.ilc().channel.ui.sidebar.max(() => {
            this.ngZone.run(() => {
                this.set().sidebar().max();
            });
        });
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + B', () => {
                this.toggle().sidebar();
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + J', () => {
                this.toggle().toolbar();
            }),
        );
        this.env().subscriber.register(
            this.resizes.toolbar.subscribe((height: number) => {
                this.toolbar.set(height);
                this.markChangesForCheck();
                this.ilc().emitter.ui.toolbar.resize();
            }),
        );
        this.env().subscriber.register(
            this.resizes.sidebar.subscribe((width: number) => {
                this.sidebar.set(width);
                this.markChangesForCheck();
                this.ilc().emitter.ui.sidebar.resize();
            }),
        );
    }

    public ngLayoutResize(rect: DOMRect) {
        this._updateSizes(rect).detectChanges();
    }

    public ngWorkspaceStyle(): { [key: string]: string } {
        if (this.session === undefined) {
            return {
                right: '0px',
                left: '0px',
                bottom: '0px',
            };
        }
        return {
            right: `${this.session.sidebar() !== undefined ? this.sidebar.value : 0}px`,
            left: `0px`,
            bottom: `${this.session.toolbar() !== undefined ? this.toolbar.value : 0}px`,
        };
    }

    public ngToolbarStyle(): { [key: string]: string } {
        return {
            right: `${this.sidebar.value}px`,
            left: `0px`,
            height: `${this.toolbar.value}px`,
        };
    }

    public ngToolbarResizeStyle(): { [key: string]: string } {
        return {
            right: `${this.sidebar.value}px`,
            left: `0px`,
            bottom: `${this.toolbar.value}px`,
        };
    }

    public ngSidebarStyle(): { [key: string]: string } {
        return {
            width: `${this.sidebar.value}px`,
        };
    }

    public onDropFile(files: File[]) {
        if (files.length === 0) {
            return;
        }
        const action = new FileAnyAction();
        if (files.length === 1) {
            action.from(files[0]);
        } else {
            action.multiple(files);
        }
    }

    protected toggle(): {
        sidebar(): void;
        toolbar(): void;
        occupy(): void;
    } {
        const session = this.ilc().services.system.session.active().base();
        return {
            sidebar: (): void => {
                if (session === undefined) {
                    return;
                }
                this.sidebar.toggle();
                this.detectChanges();
                this.ilc().emitter.ui.sidebar.resize();
            },
            toolbar: (): void => {
                if (session === undefined) {
                    return;
                }
                this.toolbar.toggle();
                this.detectChanges();
                this.ilc().emitter.ui.toolbar.resize();
            },
            occupy: (): void => {
                if (session === undefined) {
                    return;
                }
                this.toolbar.occupy();
                this.detectChanges();
                this.ilc().emitter.ui.toolbar.resize();
            },
        };
    }

    protected set(): {
        toolbar(): {
            min(): void;
            max(): void;
        };
        sidebar(): {
            min(): void;
            max(): void;
        };
    } {
        return {
            toolbar: () => {
                return {
                    min: (): void => {
                        this.toolbar.to().min();
                        this.detectChanges();
                    },
                    max: (): void => {
                        this.toolbar.to().max();
                        this.detectChanges();
                    },
                };
            },
            sidebar: () => {
                return {
                    min: (): void => {
                        this.sidebar.to().min();
                        this.detectChanges();
                    },
                    max: (): void => {
                        this.sidebar.to().max();
                        this.detectChanges();
                    },
                };
            },
        };
    }

    private _updateSizes(rect?: DOMRect): Layout {
        if (this.session === undefined) {
            return this;
        }
        if (rect !== undefined) {
            this._layout = rect;
        }
        if (this._layout === undefined) {
            return this;
        }
        this.toolbar.setMax(Math.ceil(this._layout.height * TOOLBAR_MAX_SIZE_RATE));
        this.sidebar.setMax(Math.ceil(this._layout.width * SIDEBAR_MAX_SIZE_RATE));
        return this;
    }

    private _onSessionChange() {
        const session = this.ilc().services.system.session.active().base();
        if (this.session !== undefined) {
            this._updateSizes();
            this._sessions.set(this.session.uuid(), {
                toolbar: this.toolbar.value,
                sidebar: this.sidebar.value,
            });
        }
        if (session !== undefined) {
            const heights = this._sessions.get(session.uuid());
            if (heights !== undefined) {
                this.toolbar.set(heights.toolbar);
                this.sidebar.set(heights.sidebar);
            } else {
                this.toolbar = initialToolbarHeight();
                this.sidebar = initialSidebarWidth();
            }
        }
        this.session = session;
        this._updateSizes();
        this.detectChanges();
    }

    private _onSessionClosed(session: string) {
        this._sessions.delete(session);
        if (this.session !== undefined && this.session.uuid() === session) {
            this.session = undefined;
        }
        this.detectChanges();
    }
}
export interface Layout extends IlcInterface {}

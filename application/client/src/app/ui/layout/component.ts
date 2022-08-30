import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    HostBinding,
    SkipSelf,
    NgZone,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Direction } from '@directives/resizer';
import { Base } from '@service/session';

const TOOLBAR_NORMAL_HEIGHT = 250;
const SIDEBAR_NORMAL_WIDTH = 350;
const TOOLBAR_MIN_HEIGHT = 50;
const SIDEBAR_MIN_WIDTH = 50;
const TOOLBAR_MAX_SIZE_RATE = 0.7;
const SIDEBAR_MAX_SIZE_RATE = 0.7;

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

    private _layout: DOMRect | undefined;
    private readonly _sessions: Map<string, { toolbar: number; sidebar: number }> = new Map();

    constructor(@SkipSelf() cdRef: ChangeDetectorRef, private ngZone: NgZone) {
        super(cdRef);
        this.ilc().channel.session.change(this._onSessionChange.bind(this));
        this.ilc().channel.session.close(this._onSessionClosed.bind(this));
    }

    public ngAfterViewInit(): void {
        this._onSessionChange();
        this.ilc().channel.ui.popup.updated(() => {
            this.ngZone.run(() => {
                this.detectChanges();
            });
        });
    }

    public ngSidebarResize(width: number) {
        this.sidebar.set(width);
        this.detectChanges();
    }

    public ngToolbarResize(height: number) {
        this.toolbar.set(height);
        this.detectChanges();
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

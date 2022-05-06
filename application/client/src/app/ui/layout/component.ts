import {
    Component,
    ChangeDetectorRef,
    ViewContainerRef,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Direction } from '@directives/resizer';
import { Session } from '@service/session';

import * as ThemeParams from '@styles/sizes';

const TOOLBAR_NORMAL_HEIGHT = 250;
const SIDEBAR_NORMAL_WIDTH = 250;
const TOOLBAR_MIN_HEIGHT = 50;
const SIDEBAR_MIN_WIDTH = 50;
const TOOLBAR_MAX_SIZE_RATE = 0.7;
const SIDEBAR_MAX_SIZE_RATE = 0.7;

@Component({
    selector: 'app-layout',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Layout extends ChangesDetector {
    public readonly Direction = Direction;

    public toolbar: LimittedValue = new LimittedValue(
        'toolbar.height',
        TOOLBAR_MIN_HEIGHT,
        -1,
        TOOLBAR_NORMAL_HEIGHT,
    );
    public sidebar: LimittedValue = new LimittedValue(
        'sidebar.width',
        SIDEBAR_MIN_WIDTH,
        -1,
        SIDEBAR_NORMAL_WIDTH,
    );
    public session: Session | undefined;

    private _layout: DOMRect | undefined;
    private _sessions: Map<string, { toolbar: number; sidebar: number }> = new Map();

    constructor(cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {
        super(cdRef);
        // this._subscriptions.minimizedFunc = this.funcBarState
        //     .getObservable()
        //     .minimized.subscribe(this._onFuncMinimized.bind(this));
        // this._subscriptions.updatedFunc = this.funcBarState
        //     .getObservable()
        //     .updated.subscribe(this._onFuncStateUpdated.bind(this));
        // this._subscriptions.minimizedSecondary = this.secAreaState
        //     .getObservable()
        //     .minimized.subscribe(this._onSecAreaMinimized.bind(this));
        // this._subscriptions.updatedSecondary = this.secAreaState
        //     .getObservable()
        //     .updated.subscribe(this._onSecAreaStateUpdated.bind(this));
        // this._subscriptions.onSidebarMax =
        //     LayoutStateService.getObservable().onSidebarMax.subscribe(
        //         this._onSidebarServiceMax.bind(this),
        //     );
        // this._subscriptions.onSidebarMin =
        //     LayoutStateService.getObservable().onSidebarMin.subscribe(
        //         this._onSidebarServiceMin.bind(this),
        //     );
        // this._subscriptions.onToolbarMax =
        //     LayoutStateService.getObservable().onToolbarMax.subscribe(
        //         this._onToolbarServiceMax.bind(this),
        //     );
        // this._subscriptions.onToolbarMin =
        //     LayoutStateService.getObservable().onToolbarMin.subscribe(
        //         this._onToolbarServiceMin.bind(this),
        //     );
        // this._subscriptions.onToolbarToggle =
        //     HotkeysService.getObservable().toolbarToggle.subscribe(
        //         this._onToolbarToggle.bind(this),
        //     );
        // this._subscriptions.onSidebarToggle =
        //     HotkeysService.getObservable().sidebarToggle.subscribe(
        //         this._onSidebarToggle.bind(this),
        //     );
        this.ilc().channel.session.change(this._onSessionChange.bind(this));
        this.ilc().channel.session.close(this._onSessionClosed.bind(this));
        // LayoutStateService.setSideBarStateGetter(() => {
        //     return this.funcBarState.minimized;
        // });
        // LayoutStateService.setToolBarStateGetter(() => {
        //     return this.secAreaState.minimized;
        // });
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
        return this.session !== undefined
            ? {
                  right: `${this.sidebar.value}px`,
                  left: `0px`,
                  bottom: `${this.toolbar.value}px`,
              }
            : {
                  right: '0px',
                  left: '0px',
                  bottom: '0px',
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
        this.session = this.ilc().services.system.session.active();
        this._updateSizes();
        if (this.session !== undefined) {
            this._sessions.set(this.session.uuid(), {
                toolbar: this.toolbar.value,
                sidebar: this.sidebar.value,
            });
            const heights = this._sessions.get(this.session.uuid());
            if (heights === undefined) {
                this._sessions.set(this.session.uuid(), {
                    toolbar: this.toolbar.value,
                    sidebar: this.sidebar.value,
                });
            } else {
                this.toolbar.set(heights.toolbar);
                this.sidebar.set(heights.sidebar);
                this._updateSizes();
            }
        }
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

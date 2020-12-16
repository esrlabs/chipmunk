import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { AreaState } from './state';
import { Subscription} from 'rxjs';
import { Session } from '../controller/session/session';

import ViewsEventsService from '../services/standalone/service.views.events';
import LayoutStateService from '../services/standalone/service.layout.state';
import HotkeysService from '../services/service.hotkeys';
import EventsSessionService from '../services/standalone/service.events.session';
import TabsSessionsService from '../services/service.sessions.tabs';

import * as ThemeParams from '../theme/sizes';

enum EResizeType {
    nothing = 'nothing',
    func = 'func',
    sec = 'sec'
}

enum EFuncLocation {
    right = 'func-right',
    left = 'func-left'
}

@Component({
    selector: 'app-layout',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutComponent implements OnDestroy, AfterViewInit {

    public funcBarState: AreaState = new AreaState();
    public secAreaState: AreaState = new AreaState();
    public funcLocation: EFuncLocation = EFuncLocation.right;
    public _ng_sizes: {
        sec: {
            current: number,
            last: number
        },
        func: {
            current: number,
            last: number
        }
    } = {
        sec: {
            current: ThemeParams.tabs_list_height,
            last: ThemeParams.tabs_list_height * 13
        },
        func: {
            current: ThemeParams.tabs_list_height,
            last: ThemeParams.tabs_list_height * 13
        },
    };

    private _subscriptions: { [key: string]: Subscription } = {};
    private _session: Session;
    private _movement: {
        x: number,
        y: number,
        type: EResizeType,
    } = { x: 0, y: 0, type: EResizeType.nothing };

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscribeToWinEvents();
        this._subscriptions.minimizedFunc = this.funcBarState.getObservable().minimized.subscribe(this._onFuncMinimized.bind(this));
        this._subscriptions.updatedFunc = this.funcBarState.getObservable().updated.subscribe(this._onFuncStateUpdated.bind(this));
        this._subscriptions.minimizedSecondary = this.secAreaState.getObservable().minimized.subscribe(this._onSecAreaMinimized.bind(this));
        this._subscriptions.updatedSecondary = this.secAreaState.getObservable().updated.subscribe(this._onSecAreaStateUpdated.bind(this));
        this._subscriptions.onSidebarMax = LayoutStateService.getObservable().onSidebarMax.subscribe(this._onSidebarServiceMax.bind(this));
        this._subscriptions.onSidebarMin = LayoutStateService.getObservable().onSidebarMin.subscribe(this._onSidebarServiceMin.bind(this));
        this._subscriptions.onToolbarMax = LayoutStateService.getObservable().onToolbarMax.subscribe(this._onToolbarServiceMax.bind(this));
        this._subscriptions.onToolbarMin = LayoutStateService.getObservable().onToolbarMin.subscribe(this._onToolbarServiceMin.bind(this));
        this._subscriptions.onToolbarToggle = HotkeysService.getObservable().toolbarToggle.subscribe(this._onToolbarToggle.bind(this));
        this._subscriptions.onSidebarToggle = HotkeysService.getObservable().sidebarToggle.subscribe(this._onSidebarToggle.bind(this));
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        LayoutStateService.setSideBarStateGetter(() => {
            return this.funcBarState.minimized;
        });
        LayoutStateService.setToolBarStateGetter(() => {
            return this.secAreaState.minimized;
        });
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();

        });
        this._unsubscribeToWinEvents();
    }

    ngAfterViewInit() {
        this._session = TabsSessionsService.getActive();
    }

    public _ng_hasActiveSession(): boolean {
        return this._session !== undefined;
    }

    private _subscribeToWinEvents() {
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Functions area
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private _onFuncMinimized(minimized: boolean) {
        if (minimized) {
            this._ng_sizes.func.last = this._ng_sizes.func.current;
            this._ng_sizes.func.current = ThemeParams.tabs_list_height;
        } else {
            this._ng_sizes.func.current = this._ng_sizes.func.last;
        }
    }

    private _onFuncStateUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }

    public _ng_onResizeFuncTrigger(event: MouseEvent) {
        if (this.funcBarState.minimized) {
            return;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._movement.type = EResizeType.func;
    }

    private _onMouseMove(event: MouseEvent) {
        if (this._movement.type === EResizeType.nothing) {
            return;
        }
        const dX = event.x - this._movement.x;
        const dY = event.y - this._movement.y;
        switch (this._movement.type) {
            case EResizeType.func:
                if (this.funcLocation === EFuncLocation.right) {
                    this._ng_sizes.func.current -= dX;
                } else {
                    this._ng_sizes.func.current += dX;
                }
                break;
            case EResizeType.sec:
                this._ng_sizes.sec.current -= dY;
                break;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    private _onMouseUp(event: MouseEvent) {
        if (this._movement.type === EResizeType.nothing) {
            return;
        }
        this._movement.x = -1;
        this._movement.y = -1;
        this._movement.type = EResizeType.nothing;
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    public _ng_onTriggerFuncState() {
        if (this.funcBarState.minimized) {
            this.funcBarState.maximize();
        } else {
            this.funcBarState.minimize();
        }
        ViewsEventsService.fire().onResize();
    }

    public _ng_onTriggerFuncLocation() {
        this.funcLocation = this.funcLocation === EFuncLocation.right ? EFuncLocation.left : EFuncLocation.right;
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    public _ng_getPrimaryStyle(): { [key: string]: string } {
       return this._session === undefined ? {} : {
            right: (this.funcLocation === 'func-right' ? this._ng_sizes.func.current : 0) + 'px',
            left: (this.funcLocation === 'func-left' ? this._ng_sizes.func.current : 0) + 'px',
            bottom: this._ng_sizes.sec.current + 'px',
       };
    }

    public _ng_getSecondaryStyle(): { [key: string]: string } {
        return this._session === undefined ? {} : {
            right: (this.funcLocation === 'func-right' ? this._ng_sizes.func.current : 0) + 'px',
            left: (this.funcLocation === 'func-left' ? this._ng_sizes.func.current : 0) + 'px',
            height: this._ng_sizes.sec.current + 'px',
       };
    }

    public _ng_getToolsResizerStyle(): { [key: string]: string } {
        return this._session === undefined ? {} : {
            marginBottom: this._ng_sizes.sec.current + 'px',
       };
    }

    public _ng_getToolsStyle(): { [key: string]: string } {
        return this._session === undefined ? {} : {
            width: this._ng_sizes.func.current + 'px',
       };
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Functions secondary area
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private _onSecAreaMinimized(minimized: boolean) {
        if (minimized) {
            this._ng_sizes.sec.last = this._ng_sizes.sec.current;
            this._ng_sizes.sec.current = ThemeParams.tabs_list_height;
        } else {
            this._ng_sizes.sec.current = this._ng_sizes.sec.last;
        }
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    private _onSecAreaStateUpdated(state: AreaState) {
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    public _ng_onResizeSecAreaTrigger(event: MouseEvent) {
        if (this.secAreaState.minimized) {
            return;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._movement.type = EResizeType.sec;
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service listener
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _onSidebarServiceMax() {
        if (!this.funcBarState.minimized) {
            return;
        }
        this.funcBarState.maximize();
        ViewsEventsService.fire().onResize();
        this._cdRef.detectChanges();
    }

    private _onSidebarServiceMin() {
        if (this.funcBarState.minimized) {
            return;
        }
        this.funcBarState.minimize();
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    private _onSidebarToggle() {
        if (this.funcBarState.minimized) {
            this._onSidebarServiceMax();
        } else {
            this._onSidebarServiceMin();
        }
    }

    private _onToolbarServiceMax() {
        if (!this.secAreaState.minimized) {
            return;
        }
        this.secAreaState.maximize();
        ViewsEventsService.fire().onResize();
        this._cdRef.detectChanges();
    }

    private _onToolbarServiceMin() {
        if (this.secAreaState.minimized) {
            return;
        }
        this.secAreaState.minimize();
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    private _onToolbarToggle() {
        if (this.secAreaState.minimized) {
            this._onToolbarServiceMax();
        } else {
            this._onToolbarServiceMin();
        }
    }

    private _onSessionChange(controller?: Session) {
        this._session = controller;
        this._cdRef.detectChanges();
    }

}

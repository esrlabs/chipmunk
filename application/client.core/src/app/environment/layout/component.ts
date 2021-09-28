import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    ViewContainerRef,
} from '@angular/core';
import { AreaState } from './state';
import { Subscription } from 'rxjs';
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
    sec = 'sec',
}

enum EFuncLocation {
    right = 'func-right',
    left = 'func-left',
}

const FUNC_MIN_WIDTH = 50;
const SEC_MIN_WIDTH = 50;
const MAX_SIZE_RATE = 0.7;

@Component({
    selector: 'app-layout',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutComponent implements OnDestroy, AfterViewInit {
    public funcBarState: AreaState = new AreaState();
    public secAreaState: AreaState = new AreaState();
    public funcLocation: EFuncLocation = EFuncLocation.right;
    public _ng_sizes: {
        sec: {
            current: number;
            last: number;
        };
        func: {
            current: number;
            last: number;
        };
        holder: {
            width: number;
            height: number;
        };
    } = {
        sec: {
            current: ThemeParams.tabs_list_height,
            last: ThemeParams.tabs_list_height * 13,
        },
        func: {
            current: ThemeParams.tabs_list_height,
            last: ThemeParams.tabs_list_height * 13,
        },
        holder: {
            height: 0,
            width: 0,
        },
    };

    private _subscriptions: { [key: string]: Subscription } = {};
    private _toolbarHeights: { [guid: string]: number } = {};
    private _session: Session | undefined;
    private _movement: {
        x: number;
        y: number;
        type: EResizeType;
    } = { x: 0, y: 0, type: EResizeType.nothing };

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {
        this._subscribeToWinEvents();
        this._subscriptions.minimizedFunc = this.funcBarState
            .getObservable()
            .minimized.subscribe(this._onFuncMinimized.bind(this));
        this._subscriptions.updatedFunc = this.funcBarState
            .getObservable()
            .updated.subscribe(this._onFuncStateUpdated.bind(this));
        this._subscriptions.minimizedSecondary = this.secAreaState
            .getObservable()
            .minimized.subscribe(this._onSecAreaMinimized.bind(this));
        this._subscriptions.updatedSecondary = this.secAreaState
            .getObservable()
            .updated.subscribe(this._onSecAreaStateUpdated.bind(this));
        this._subscriptions.onSidebarMax =
            LayoutStateService.getObservable().onSidebarMax.subscribe(
                this._onSidebarServiceMax.bind(this),
            );
        this._subscriptions.onSidebarMin =
            LayoutStateService.getObservable().onSidebarMin.subscribe(
                this._onSidebarServiceMin.bind(this),
            );
        this._subscriptions.onToolbarMax =
            LayoutStateService.getObservable().onToolbarMax.subscribe(
                this._onToolbarServiceMax.bind(this),
            );
        this._subscriptions.onToolbarMin =
            LayoutStateService.getObservable().onToolbarMin.subscribe(
                this._onToolbarServiceMin.bind(this),
            );
        this._subscriptions.onToolbarToggle =
            HotkeysService.getObservable().toolbarToggle.subscribe(
                this._onToolbarToggle.bind(this),
            );
        this._subscriptions.onSidebarToggle =
            HotkeysService.getObservable().sidebarToggle.subscribe(
                this._onSidebarToggle.bind(this),
            );
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onSessionClosed =
            EventsSessionService.getObservable().onSessionClosed.subscribe(
                this._onSessionClosed.bind(this),
            );
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
            this._getHolderSize();
            if (this._ng_sizes.func.last > this._ng_sizes.holder.width * MAX_SIZE_RATE) {
                this._ng_sizes.func.last = this._ng_sizes.holder.width * MAX_SIZE_RATE;
            }
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
        this._ng_sizes.func.last = this._ng_sizes.func.current;
        this._getHolderSize();
    }

    private _onMouseMove(event: MouseEvent) {
        const drop = () => {
            this._movement.x = -1;
            this._movement.y = -1;
            this._movement.type = EResizeType.nothing;
            event.stopImmediatePropagation();
            event.stopPropagation();
            event.preventDefault();
            this._cdRef.detectChanges();
            ViewsEventsService.fire().onResize();
        };
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
                if (this._ng_sizes.func.current < FUNC_MIN_WIDTH) {
                    this._ng_sizes.func.current = this._ng_sizes.func.last;
                    this.funcBarState.minimize();
                    drop();
                } else if (
                    this._ng_sizes.func.current >
                    this._ng_sizes.holder.width * MAX_SIZE_RATE
                ) {
                    this._ng_sizes.func.current = this._ng_sizes.holder.width * MAX_SIZE_RATE;
                }
                break;
            case EResizeType.sec:
                this._ng_sizes.sec.current -= dY;
                if (this._ng_sizes.sec.current < SEC_MIN_WIDTH) {
                    this._ng_sizes.sec.current = this._ng_sizes.sec.last;
                    this.secAreaState.minimize();
                    drop();
                } else if (
                    this._ng_sizes.sec.current >
                    this._ng_sizes.holder.height * MAX_SIZE_RATE
                ) {
                    this._ng_sizes.sec.current = this._ng_sizes.holder.height * MAX_SIZE_RATE;
                }
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
        if (!this.funcBarState.minimized && this._movement.type === EResizeType.func) {
            this._ng_sizes.func.last = this._ng_sizes.func.current;
        }
        if (!this.secAreaState.minimized && this._movement.type === EResizeType.sec) {
            this._ng_sizes.sec.last = this._ng_sizes.sec.current;
        }
        this._movement.x = -1;
        this._movement.y = -1;
        this._movement.type = EResizeType.nothing;
        this._saveHeight();
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
        this.funcLocation =
            this.funcLocation === EFuncLocation.right ? EFuncLocation.left : EFuncLocation.right;
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    public _ng_getPrimaryStyle(): { [key: string]: string } {
        return this._session === undefined
            ? {}
            : {
                  right:
                      (this.funcLocation === 'func-right' ? this._ng_sizes.func.current : 0) + 'px',
                  left:
                      (this.funcLocation === 'func-left' ? this._ng_sizes.func.current : 0) + 'px',
                  bottom: this._ng_sizes.sec.current + 'px',
              };
    }

    public _ng_getSecondaryStyle(): { [key: string]: string } {
        return this._session === undefined
            ? {}
            : {
                  right:
                      (this.funcLocation === 'func-right' ? this._ng_sizes.func.current : 0) + 'px',
                  left:
                      (this.funcLocation === 'func-left' ? this._ng_sizes.func.current : 0) + 'px',
                  height: this._ng_sizes.sec.current + 'px',
              };
    }

    public _ng_getToolsResizerStyle(): { [key: string]: string } {
        return this._session === undefined
            ? {}
            : {
                  marginBottom: this._ng_sizes.sec.current + 'px',
              };
    }

    public _ng_getToolsStyle(): { [key: string]: string } {
        return this._session === undefined
            ? {}
            : {
                  width: this._ng_sizes.func.current + 'px',
              };
    }

    private _getHolderSize() {
        const size: ClientRect = (
            this._vcRef.element.nativeElement as HTMLElement
        ).getBoundingClientRect();
        this._ng_sizes.holder.height = size.height;
        this._ng_sizes.holder.width = size.width;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Functions secondary area
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private _onSecAreaMinimized(minimized: boolean) {
        if (minimized) {
            this._ng_sizes.sec.last = this._ng_sizes.sec.current;
            this._ng_sizes.sec.current = ThemeParams.tabs_list_height;
        } else {
            this._getHolderSize();
            if (this._ng_sizes.sec.last > this._ng_sizes.holder.height * MAX_SIZE_RATE) {
                this._ng_sizes.sec.last = this._ng_sizes.holder.height * MAX_SIZE_RATE;
            }
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
        this._ng_sizes.sec.last = this._ng_sizes.sec.current;
        this._getHolderSize();
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

    private _saveHeight() {
        if (this._session !== undefined) {
            this._toolbarHeights[this._session.getGuid()] = this._ng_sizes.sec.current;
        }
    }

    private _loadHeight() {
        if (this._session !== undefined) {
            const height = this._toolbarHeights[this._session.getGuid()];
            if (height === undefined) {
                this._ng_sizes.sec.current = ThemeParams.tabs_list_height * 13;
            } else {
                this._ng_sizes.sec.current = height;
            }
        }
        this._ng_sizes.sec.last = this._ng_sizes.sec.current;
    }

    private _onSessionChange(controller?: Session) {
        this._session = controller;
        this._loadHeight();
        this._cdRef.detectChanges();
        ViewsEventsService.fire().onResize();
    }

    private _onSessionClosed(guid: string) {
        delete this._toolbarHeights[guid];
    }
}

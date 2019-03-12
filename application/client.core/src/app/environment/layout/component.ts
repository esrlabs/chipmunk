import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from './state';
import { Subscription } from 'rxjs';
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

export class LayoutComponent implements OnDestroy {

    public funcBarState: AreaState = new AreaState();
    public secAreaState: AreaState = new AreaState();
    public funcLocation: EFuncLocation = EFuncLocation.right;

    private _funcBarStateSubscriptions: {
        minimized: Subscription | null,
        updated: Subscription | null,
    } = {
        minimized: null,
        updated: null,
    };

    private _secAreaStateSubscriptions: {
        minimized: Subscription | null,
        updated: Subscription | null,
    } = {
        minimized: null,
        updated: null,
    };

    private _sizes: {
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

    private _movement: {
        x: number,
        y: number,
        type: EResizeType,
    } = { x: 0, y: 0, type: EResizeType.nothing };

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscribeToWinEvents();
        this._funcBarStateSubscriptions.minimized = this.funcBarState.getObservable().minimized.subscribe(this._onFuncMinimized.bind(this));
        this._funcBarStateSubscriptions.updated = this.funcBarState.getObservable().updated.subscribe(this._onFuncStateUpdated.bind(this));
        this._secAreaStateSubscriptions.minimized = this.secAreaState.getObservable().minimized.subscribe(this._onSecAreaMinimized.bind(this));
        this._secAreaStateSubscriptions.updated = this.secAreaState.getObservable().updated.subscribe(this._onSecAreaStateUpdated.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._funcBarStateSubscriptions).forEach((key: string) => {
            if (this._funcBarStateSubscriptions[key] !== null) {
                this._funcBarStateSubscriptions[key].unsubscribe();
            }
        });
        Object.keys(this._secAreaStateSubscriptions).forEach((key: string) => {
            if (this._secAreaStateSubscriptions[key] !== null) {
                this._secAreaStateSubscriptions[key].unsubscribe();
            }
        });
        this._unsubscribeToWinEvents();
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
            this._sizes.func.last = this._sizes.func.current;
            this._sizes.func.current = ThemeParams.tabs_list_height;
        } else {
            this._sizes.func.current = this._sizes.func.last;
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
                    this._sizes.func.current -= dX;
                } else {
                    this._sizes.func.current += dX;
                }
                break;
            case EResizeType.sec:
                this._sizes.sec.current -= dY;
                break;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._cdRef.detectChanges();
    }

    private _onMouseUp(event: MouseEvent) {
        if (this._movement.type === EResizeType.nothing) {
            return;
        }
        this._movement.x = -1;
        this._movement.y = -1;
        this._movement.type = EResizeType.nothing;
        this._cdRef.detectChanges();
    }

    public _ng_onTriggerFuncState() {
        if (this.funcBarState.minimized) {
            this.funcBarState.maximize();
        } else {
            this.funcBarState.minimize();
        }
    }

    public _ng_onTriggerFuncLocation() {
        this.funcLocation = this.funcLocation === EFuncLocation.right ? EFuncLocation.left : EFuncLocation.right;
        this._cdRef.detectChanges();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Functions secondary area
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private _onSecAreaMinimized(minimized: boolean) {
        if (minimized) {
            this._sizes.sec.last = this._sizes.sec.current;
            this._sizes.sec.current = ThemeParams.tabs_list_height;
        } else {
            this._sizes.sec.current = this._sizes.sec.last;
        }
        this._cdRef.detectChanges();
    }

    private _onSecAreaStateUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }

    public _ng_onResizeSecAreaTrigger(event: MouseEvent) {
        if (this.secAreaState.minimized) {
            return;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._movement.type = EResizeType.sec;
        this._cdRef.detectChanges();
    }

}

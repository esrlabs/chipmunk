import { Component, Input, OnChanges, OnDestroy, ChangeDetectorRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { DockDef, DocksService } from '../../services/service.docks';
import { Subject } from 'rxjs';

import * as Tools from '../../tools/index';

export interface IDocksAreaSize {
    height: number;
    width: number;
}

@Component({
    selector: 'app-layout-docking',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutDockingComponent implements OnChanges, OnDestroy {

    @Input() public service: DocksService | null = null;

    public dock: DockDef.IDock | null;

    private _width: number = -1;
    private _height: number = -1;

    private _subscriptions: {
        docks: Subscription | null,
    } = {
        docks: null
    };

    private _sessionId: string = '';

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._subscribeToWinEvents();
    }

    ngOnChanges() {
        if (this.service === null) {
            return;
        }
        if (this.service.getSessionId() !== this._sessionId) {
            if (this._subscriptions.docks !== null) {
                this._subscriptions.docks.unsubscribe();
            }
            this._resetDock();
            this._subscriptions.docks = this.service.getObservable().docks.subscribe(this._onAddDock.bind(this));
            this.dock = this.service.get();
            this._cdRef.detectChanges();
        }
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
        this._unsubscribeToWinEvents();
        this.service.destroy();
    }

    public getDocksAreaSize(): IDocksAreaSize {
        if (this._height <= 0 || this._width <= 0) {
            this._updateSizeData();
        }
        return {
            height: this._height,
            width: this._width
        };
    }

    private _resetDock() {
        this.dock = null;
        this._cdRef.detectChanges();
    }

    private _subscribeToWinEvents() {
        window.addEventListener('resize', this._onWindowResize.bind(this));
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    private _updateSizeData() {
        if (this._vcRef === null || this._vcRef === undefined) {
            return;
        }
        const size = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._width = size.width;
        this._height = size.height;
    }

    private _onAddDock(dock: DockDef.IDock) {
        // this.docks.set(dock.id, dock);
    }

    private _onWindowResize(event: Event) {
        this._updateSizeData();
    }

}

import { Component, Input, OnChanges, OnDestroy, ChangeDetectorRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { IDock, DocksService, Coor } from '../../services/service.docks';
import { Subject } from 'rxjs';

import * as Tools from '../../tools/index';

export interface ISizeDocksArea {
    height: number;
    width: number;
}

interface ISpace {
    t: number;
    l: number;
    w: number;
    h: number;
    active: boolean;
}

@Component({
    selector: 'app-layout-docking',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutDockingComponent implements OnChanges, OnDestroy {

    @Input() public service: DocksService | null = null;

    public docks: Map<string, IDock> = new Map();
    public width: number = -1;
    public height: number = -1;
    public spaceA: ISpace | null = null;
    public spaceB: ISpace | null = null;

    private _subscriptionDocks: Subscription | null = null;
    private _subscriptionStartedManipulate: Subscription | null = null;
    private _sessionId: string = '';
    private _sizeDockArea = new Subject<ISizeDocksArea>();

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._subscribeToWinEvents();
        this.getSizeDocksArea = this.getSizeDocksArea.bind(this);
    }

    ngOnChanges() {
        if (this.width <= 0 || this.height <= 0) {
            this._updateSizeData();
        }
        if (this.service === null) {
            return;
        }
        if (this.service.getSessionId() !== this._sessionId) {
            if (this._subscriptionDocks !== null) {
                this._subscriptionDocks.unsubscribe();
            }
            this._subscriptionDocks = this.service.getDocksObservable().subscribe(this._onAddDock.bind(this));
            if (this._subscriptionStartedManipulate !== null) {
                this._subscriptionStartedManipulate.unsubscribe();
            }
            this._subscriptionStartedManipulate = this.service.getStartedManipulationObservable().subscribe(this._onStartedManipulation.bind(this));
            this.docks = this.service.get();
        }
        this._cdRef.detectChanges();
    }

    ngOnDestroy() {
        this._subscriptionDocks.unsubscribe();
        this._subscriptionStartedManipulate.unsubscribe();
        this._unsubscribeToWinEvents();
        this.service.destroy();
    }

    public getSizeDocksArea(): ISizeDocksArea {
        return {
            height: this.height,
            width: this.width
        };
    }

    public onDocksAreaDblClick(event: MouseEvent) {
        const space: Coor = this.service.getFreeSpaceFromPoint({ t: event.offsetY, l: event.offsetX, h: this.height, w: this.width });
        const rateByH: number = this.height / space.r;
        const rateByW: number = this.width / space.c;
        let refA, refB;
        if (this.spaceA === null) {
            refA = 'spaceA'; refB = 'spaceB';
        } else {
            refA = 'spaceB'; refB = 'spaceA';
        }
        this[refA] = {
            t: space.t * rateByH,
            h: space.h * rateByH,
            l: space.l * rateByW,
            w: space.w * rateByW,
            active: true
        };
        if (this[refB] !== null) {
            this[refB].active = false;
            const copy = this[refB];
            this[refB] = null;
            this._cdRef.detectChanges();
            this[refB] = copy;
            setTimeout(() => {
                this[refB] = null;
            }, 300);
        }
    }

    public onDropAreaSpaces() {
        this._removeDocksAreaSpaces();
    }

    private _removeDocksAreaSpaces() {
        ['spaceA', 'spaceB'].forEach((ref: string) => {
            if (this[ref] !== null) {
                this[ref].active = false;
                const copy = this[ref];
                this[ref] = null;
                this._cdRef.detectChanges();
                this[ref] = copy;
                setTimeout(() => {
                    this[ref] = null;
                }, 300);
            }
        });
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
        this.width = size.width;
        this.height = size.height;
    }

    private _onAddDock(dock: IDock) {
        dock = this._normalize(dock);
        if (dock === null) {
            return;
        }
        this.docks.set(dock.id, dock);
    }

    private _onStartedManipulation() {
        this._removeDocksAreaSpaces();
    }

    private _normalize(dock: IDock): IDock | null {
        if (typeof dock !== 'object' || dock === null) {
            return null;
        }
        dock.id = typeof dock.id === 'string' ? (dock.id.trim() !== '' ? dock.id : Tools.guid()) : Tools.guid();
        return dock;
    }

    private _onWindowResize(event: Event) {
        this._updateSizeData();
        this._sizeDockArea.next({
            height: this.height,
            width: this.width
        });
    }

}

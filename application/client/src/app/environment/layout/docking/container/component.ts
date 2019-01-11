import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef } from '@angular/core';
import { DockDef, DocksService } from '../../../services/service.docks';
import { Subscription } from 'rxjs';
import { Observable } from 'rxjs';
import { IDocksAreaSize } from '../component';

interface IWrapperPosition {
    t: string;
    l: string;
    w: string;
    h: string;
}

enum EActivities {
    pending = 'pending',
    dragingTrigger = 'dragingTrigger',
    resizing = 'resizing'
}

@Component({
    selector: 'app-layout-docking-container',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutDockContainerComponent implements AfterViewInit, OnDestroy {

    @Input() public dock: DockDef.IDock;
    @Input() public service: DocksService;

    public positions: { [key: string]: IWrapperPosition } = {
        dock: { t: '0', l: '0', w: '100%', h: '100%' },
        child: { t: '0', l: '0', w: '100%', h: '100%' },
        resizer: { t: '0', l: '0', w: '100%', h: '100%' },
    };

    public parking: boolean = false;
    public activeParking: string = '';
    public draggable: boolean = false;
    public draggedDockId: string = '';

    private _subscriptions: {
        dragStarted: Subscription | null,
        dragFinished: Subscription | null,
    } = {
        dragStarted: null,
        dragFinished: null,
    };
    private _width: number = -1;
    private _height: number = -1;
    private _movement: {
        x: number,
        y: number,
        scaleX: number,
        scaleY: number,
    } = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

    private _activity: EActivities = EActivities.pending;

    constructor(private _cdRef: ChangeDetectorRef,
        private _vcRef: ViewContainerRef) {
    }

    ngOnDestroy() {
        this._unsubscribeToWinEvents();
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    ngAfterViewInit() {
        this._subscriptions.dragStarted = this.service.getObservable().dragStarted.subscribe(this._onDragStarted.bind(this));
        this._subscriptions.dragFinished = this.service.getObservable().dragFinished.subscribe(this._onDragFinished.bind(this));
        this._updatePosition();
    }

    public onDragTrigger(event: MouseEvent, dockId: string) {
        this._activity = EActivities.dragingTrigger;
        this.draggedDockId = dockId;
        this.draggable = true;
        this._cdRef.detectChanges();
        this.service.dragStarted(dockId);
        console.log(dockId);
    }

    public onStartDrag(event: DragEvent, dockId: string) {
    }

    public onEndDrag(event: DragEvent, dockId: string) {
        this._finishActivity();
        this.service.dragFinished(dockId);
    }

    public onDragOver(event: DragEvent, parking: string) {
        this.activeParking = parking;
    }

    public onDragLeave(event: DragEvent) {
        this.activeParking = '';
    }

    public onResizeTrigger(event: MouseEvent) {
        this._subscribeToWinEvents();
        this._activity = EActivities.resizing;
        this._updateSizeData();
        this._movement.scaleX = this._width / 100;
        this._movement.scaleY = this._height / 100;
        this._movement.x = event.x;
        this._movement.y = event.y;
        console.log(this._movement);
    }

    private _onMouseMove(event: MouseEvent) {
        if (this._activity === EActivities.pending) {
            return this._unsubscribeToWinEvents();
        }
        if (this._activity === EActivities.resizing) {
            const dX = event.x - this._movement.x;
            const dY = event.y - this._movement.y;
            switch (this.dock.position.position) {
                case DockDef.EDockPosition.vertical:
                    this.dock.position.weight += ((dY / this._movement.scaleY) / 100);
                    break;
                case DockDef.EDockPosition.horizontal:
                    this.dock.position.weight += ((dX / this._movement.scaleX) / 100);
                    break;
            }
            this._movement.x = event.x;
            this._movement.y = event.y;
            this._updatePosition();
        }
    }

    private _onMouseUp(event: MouseEvent) {
        this._finishActivity();
    }

    private _finishActivity() {
        this._unsubscribeToWinEvents();
        switch (this._activity) {
            case EActivities.resizing:
                break;
            case EActivities.dragingTrigger:
                this.draggable = false;
                this._cdRef.detectChanges();
                break;
        }
        this._activity = EActivities.pending;
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

    private _updatePosition() {
        this.positions = {
            dock: { t: '0', l: '0', w: '100%', h: '100%' },
            child: { t: '0', l: '0', w: '100%', h: '100%' },
            resizer: { t: '0', l: '0', w: '100%', h: '100%' },
        };
        if (this.dock.child === undefined) {
            return;
        }
        switch (this.dock.position.position) {
            case DockDef.EDockPosition.vertical:
                this.positions.dock.h = this.dock.position.weight * 100 + '%';
                this.positions.child.h = (1 - this.dock.position.weight) * 100 + '%';
                this.positions.child.t = this.dock.position.weight * 100 + '%';
                this.positions.resizer.t = `calc(${this.dock.position.weight * 100}% - 3px)`;
                this.positions.resizer.h = `6px`;
                break;
            case DockDef.EDockPosition.horizontal:
                this.positions.dock.w = this.dock.position.weight * 100 + '%';
                this.positions.child.w = (1 - this.dock.position.weight) * 100 + '%';
                this.positions.child.l = this.dock.position.weight * 100 + '%';
                this.positions.resizer.l = `calc(${this.dock.position.weight * 100}% - 3px)`;
                this.positions.resizer.w = `6px`;
                break;
        }
        this._cdRef.detectChanges();
    }

    private _updateSizeData() {
        if (this._vcRef === null || this._vcRef === undefined) {
            return;
        }
        const size = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._width = size.width;
        this._height = size.height;
    }

    private _onDragStarted(id: string) {
        this.draggedDockId = id;
        this.parking = true;
        // this._cdRef.detectChanges();
        console.log(`started with: ${id}`);
    }

    private _onDragFinished(id: string) {
        this.draggedDockId = '';
        this.parking = false;
        // this._cdRef.detectChanges();
        console.log(`finished with: ${id}`);
    }

}

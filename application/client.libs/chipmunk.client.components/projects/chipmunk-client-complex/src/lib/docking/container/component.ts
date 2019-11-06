import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, OnChanges } from '@angular/core';
import { DockDef, DocksService } from '../service';
import { Subscription } from 'rxjs';

interface IWrapperPosition {
    t: string;
    l: string;
    w: string;
    h: string;
    draggable: boolean;
    place: string;      // parking place,
    parking: boolean;   // parking activation
}

enum EActivities {
    pending = 'pending',
    resizing = 'resizing'
}

const REDRAW_DELAY = 150;

@Component({
    selector: 'lib-complex-docking-container',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DockContainerComponent implements AfterViewInit, OnDestroy, OnChanges {

    @Input() public dock: DockDef.Container;
    @Input() public service: DocksService;

    public positions: {
        a: IWrapperPosition,
        b: IWrapperPosition,
        r: IWrapperPosition,
    } = {
        a: { t: '0', l: '0', w: '100%', h: '100%', place: '', parking: false, draggable: false },
        b: { t: '0', l: '0', w: '100%', h: '100%', place: '', parking: false, draggable: false },
        r: { t: '0', l: '0', w: '100%', h: '100%', place: '', parking: false, draggable: false },
    };
    public draggedDockId: string = '';
    public dragdedDockKey: string = '';
    public notDragdedDockKey: string = '';

    private _subscriptions: {
        dragStarted: Subscription | null,
        dragFinished: Subscription | null,
        dragOver: Subscription | null,
    } = {
        dragStarted: null,
        dragFinished: null,
        dragOver: null,
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
    private _dragStartTimer: any = -1;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {
        this._subscribeToWinEvents();
    }

    ngOnDestroy() {
        this._unsubscribeToWinEvents();
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    ngOnChanges() {
        this._updatePosition();
    }

    ngAfterViewInit() {
        this._subscriptions.dragStarted = this.service.getObservable().dragStarted.subscribe(this._onDragStarted.bind(this));
        this._subscriptions.dragFinished = this.service.getObservable().dragFinished.subscribe(this._onDragFinished.bind(this));
        this._subscriptions.dragOver = this.service.getObservable().dragOver.subscribe(this._onDragOver.bind(this));
        this._updatePosition();
    }

    public onDragTrigger(event: MouseEvent, dockId: string) {
        this._doForById(dockId, (key: string) => {
            this.positions[key].draggable = true;
        });
    }

    public onStartDrag(event: DragEvent, dockId: string) {
        this._dragStartTimer = setTimeout(() => {
            this.draggedDockId = dockId;
            this.dragdedDockKey = this._getEntityKeyById(dockId);
            this.notDragdedDockKey = this._getReversedEntityKey(this.dragdedDockKey);
            this.service.dragStarted(dockId);
            this._cdRef.detectChanges();
            this._updatePosition();
            (event.target as HTMLElement).style.visibility = 'hidden';
        }, REDRAW_DELAY);
    }

    public onEndDrag(event: DragEvent, dockId: string) {
        this._afterDragIsFinished(event);
    }

    public onDragOver(event: DragEvent, parkingSide: string, dropHostId: string) {
        event.preventDefault();
        const dropHostKey = this._getEntityKeyById(dropHostId);
        if (typeof dropHostKey !== 'string') {
            return;
        }
        if (this.positions[dropHostKey].place === parkingSide) {
            return;
        }
        this.positions[dropHostKey].place = parkingSide;
        this.service.dragOver(dropHostId);
    }

    public onDragLeave(event: DragEvent, dropHostId: string) {
        const dropHostKey = this._getEntityKeyById(dropHostId);
        if (typeof dropHostKey !== 'string') {
            return;
        }
        if (this.positions[dropHostKey].place === '') {
            return;
        }
        this.positions[dropHostKey].place = '';
    }

    public onDragDrop(event: DragEvent, parking: string, hostDockId: string) {
        event.preventDefault();
        const draggedDockId = this.draggedDockId;
        this.service.dragDrop({ host: hostDockId, target: draggedDockId, parking: parking});
    }

    public onResizeTrigger(event: MouseEvent) {
        this._activity = EActivities.resizing;
        this._updateSizeData();
        this._movement.scaleX = this._width / 100;
        this._movement.scaleY = this._height / 100;
        this._movement.x = event.x;
        this._movement.y = event.y;
    }

    private _onMouseMove(event: MouseEvent) {
        if (this._activity !== EActivities.resizing) {
            return;
        }
        const dX = event.x - this._movement.x;
        const dY = event.y - this._movement.y;
        switch (this.dock.position.direction) {
            case DockDef.EDirection.horizontal:
                this.dock.position.weight += ((dY / this._movement.scaleY) / 100);
                break;
            case DockDef.EDirection.vertical:
                this.dock.position.weight += ((dX / this._movement.scaleX) / 100);
                break;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._updatePosition();
    }

    private _onMouseUp(event: MouseEvent) {
        if (this._activity !== EActivities.resizing) {
            return;
        }
        this._movement.x = -1;
        this._movement.y = -1;
        this._activity = EActivities.pending;
        this._cdRef.detectChanges();
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

    private _getEntityKeyById(id: string): string | undefined {
        if (this.dock.a !== void 0 && this.dock.a.id === id) {
            return 'a';
        }
        if (this.dock.b !== void 0 && this.dock.b.id === id) {
            return 'b';
        }
        return undefined;
    }

    private _getReversedEntityKey(key: string): string | undefined {
        if (key === 'a' && this.dock.b !== void 0) {
            return 'b';
        }
        if (key === 'b' && this.dock.a !== void 0) {
            return 'a';
        }
        return undefined;
    }

    private _doForBoth(handler: (key: string) => any) {
        ['a', 'b'].forEach((key: string) => {
            if (this.dock[key] !== void 0) {
                handler(key);
            }
        });
    }

    private _doForById(id: string, handler: (key: string) => any) {
        const key = this._getEntityKeyById(id);
        if (typeof key !== 'string') {
            return;
        }
        handler(key);
    }

    private _updatePosition() {
        if (this.dock === undefined || this.service === undefined) {
            return;
        }
        if (this.notDragdedDockKey !== '' && this.positions[this.notDragdedDockKey] === undefined) {
            this.notDragdedDockKey = '';
        }
        if (this.notDragdedDockKey !== '') {
            this.positions[this.notDragdedDockKey].t = '0';
            this.positions[this.notDragdedDockKey].l = '0';
            this.positions[this.notDragdedDockKey].w = '100%';
            this.positions[this.notDragdedDockKey].h = '100%';
            this.positions[this.notDragdedDockKey].parking = true;
            return this._cdRef.detectChanges();
        }
        this.positions = {
            a: { t: '0', l: '0', w: '100%', h: '100%', place: this.positions.a.place, parking: this.positions.a.parking, draggable: this.positions.a.draggable },
            b: { t: '0', l: '0', w: '100%', h: '100%', place: this.positions.b.place, parking: this.positions.b.parking, draggable: this.positions.b.draggable },
            r: { t: '0', l: '0', w: '100%', h: '100%', place: this.positions.r.place, parking: this.positions.r.parking, draggable: this.positions.r.draggable },
        };
        if (this.dock.a !== void 0 && this.dock.b !== void 0) {
            switch (this.dock.position.direction) {
                case DockDef.EDirection.horizontal:
                    this.positions.a.h = this.dock.position.weight * 100 + '%';
                    this.positions.b.h = (1 - this.dock.position.weight) * 100 + '%';
                    this.positions.b.t = this.dock.position.weight * 100 + '%';
                    this.positions.r.t = `calc(${this.dock.position.weight * 100}% - 3px)`;
                    this.positions.r.h = `6px`;
                    break;
                case DockDef.EDirection.vertical:
                    this.positions.a.w = this.dock.position.weight * 100 + '%';
                    this.positions.b.w = (1 - this.dock.position.weight) * 100 + '%';
                    this.positions.b.l = this.dock.position.weight * 100 + '%';
                    this.positions.r.l = `calc(${this.dock.position.weight * 100}% - 3px)`;
                    this.positions.r.w = `6px`;
                    break;
            }
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

    private _afterDragIsFinished(event: DragEvent) {
        clearTimeout(this._dragStartTimer);
        (event.target as HTMLElement).style.visibility = '';
        this._doForBoth((key: string) => {
            this.positions[key].draggable = false;
        });
        this._dragStartTimer = -1;
        this.service.dragFinished(this.draggedDockId);
    }

    private _onDragStarted(draggedDockId: string) {
        this._doForBoth((key: string) => {
            if (this.dock[key].id !== draggedDockId) {
                this.positions[key].parking = true;
            }
        });
        this.draggedDockId = draggedDockId;
        this._updatePosition();
    }

    private _onDragFinished(id: string) {
        if (this.draggedDockId === '') {
            return;
        }
        this.draggedDockId = '';
        this.dragdedDockKey = '';
        this.notDragdedDockKey = '';
        this._doForBoth((key: string) => {
            this.positions[key].parking = false;
        });
        this._updatePosition();
    }

    private _onDragOver(dropHostId: string) {
        this._doForBoth((key: string) => {
            if (this.dock[key].id !== dropHostId) {
                this.positions[key].place = '';
            }
        });
        this._cdRef.detectChanges();
    }

}

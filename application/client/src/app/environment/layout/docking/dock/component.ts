import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IDock, DocksService, Coor } from '../../../services/service.docks';
import { Subscription } from 'rxjs';
import { Observable } from 'rxjs';
import { ISizeDocksArea } from '../component';

const DIRECTIONS = {
    top: 'top',
    left: 'left',
    bottom: 'bottom',
    right: 'right',
    move: 'move'
};

interface ICoor {
    top: number;
    left: number;
    width: number;
    height: number;
    rateByH: number;
    rateByW: number;
}

@Component({
    selector: 'app-layout-docking-dock',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutDockingAreaComponent implements AfterViewInit, OnDestroy {

    @Input() public dock: IDock;
    @Input() public service: DocksService;
    @Input() public getSizeDocksArea: () => ISizeDocksArea;
    @Input() public sizeDocksAreaObservable: Observable<ISizeDocksArea>;

    public coors: ICoor;
    public manipulation: boolean = false;

    private _height: number = -1;
    private _width: number = -1;
    private _subscriptionResized: Subscription | null = null;
    private _subscriptionMoved: Subscription | null = null;
    private _subscriptionStartedManipulate: Subscription | null = null;
    private _subscriptionFinishedManipulate: Subscription | null = null;
    private _subscriptionResize: Subscription | null = null;
    private _direction: string | null = null;
    private _movement: {
        x: number,
        y: number,
    } = { x: 0, y: 0 };

    constructor(private _cdRef: ChangeDetectorRef) {
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
    }

    ngOnDestroy() {
        this._unsubscribeToWinEvents();
        this._subscriptionResized.unsubscribe();
        this._subscriptionMoved.unsubscribe();
        this._subscriptionStartedManipulate.unsubscribe();
        this._subscriptionFinishedManipulate.unsubscribe();
        this._subscriptionResize.unsubscribe();
    }

    ngAfterViewInit() {
        this._subscriptionResized = this.service.getResizedObservable().subscribe(this._onResized.bind(this));
        this._subscriptionMoved = this.service.getMovedObservable().subscribe(this._onMoved.bind(this));
        this._subscriptionStartedManipulate = this.service.getStartedManipulationObservable().subscribe(this._onStartedManipulate.bind(this));
        this._subscriptionFinishedManipulate = this.service.getFinishedManipulationObservable().subscribe(this._onFinishedManipulate.bind(this));
        this._subscriptionResize = this.sizeDocksAreaObservable.subscribe(this._onResize.bind(this));
        const size: ISizeDocksArea = this.getSizeDocksArea();
        this._height = size.height;
        this._width = size.width;
        this._updateCoors();
    }

    public onMouseDown(event: MouseEvent, direction: string) {
        this._direction = direction;
        this._movement.x = event.x;
        this._movement.y = event.y;
        this._subscribeToWinEvents();
        this.manipulation = false;
        this.service.startedManipulation(this.dock.id);
    }

    private _subscribeToWinEvents() {
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
    }

    private _onMouseMove(event: MouseEvent) {
        if (this._direction === null) {
            this._unsubscribeToWinEvents();
            return;
        }
        const dX = event.x - this._movement.x;
        const dY = event.y - this._movement.y;
        const coors = {
            top: this.coors.top,
            height: this.coors.height,
            left: this.coors.left,
            width: this.coors.width,
        };
        switch (this._direction) {
            case DIRECTIONS.move:
                coors.top += dY;
                coors.left += dX;
                break;
            case DIRECTIONS.top:
                coors.top += dY;
                coors.height -= dY;
                break;
            case DIRECTIONS.bottom:
                coors.height += dY;
                break;
            case DIRECTIONS.left:
                coors.left += dX;
                coors.width -= dX;
                break;
            case DIRECTIONS.right:
                coors.width += dX;
                break;
        }
        this._movement.x = event.x;
        this._movement.y = event.y;
        let allowed;
        if (this._direction !== DIRECTIONS.move) {
            allowed = this.service.isAbleToResize(
                this.dock.id,
                Math.round(coors.top / this.coors.rateByH),
                Math.round(coors.left / this.coors.rateByW),
                Math.round(coors.width / this.coors.rateByW),
                Math.round(coors.height / this.coors.rateByH));
                if (allowed.byHeight) {
                    this.coors.top = coors.top;
                    this.coors.height = coors.height;
                }
                if (allowed.byWidth) {
                    this.coors.left = coors.left;
                    this.coors.width = coors.width;
                }
        } else {
            allowed = this.service.isAbleToMove(
                this.dock.id,
                Math.round(coors.top / this.coors.rateByH),
                Math.round(coors.left / this.coors.rateByW));
                if (allowed.byHeight) {
                    this.coors.top = coors.top;
                }
                if (allowed.byWidth) {
                    this.coors.left = coors.left;
                }
        }
        if (this._direction !== DIRECTIONS.move) {
            this.service.resized(
                this.dock.id,
                Math.round(this.coors.top / this.coors.rateByH),
                Math.round(this.coors.left / this.coors.rateByW),
                Math.round(this.coors.width / this.coors.rateByW),
                Math.round(this.coors.height / this.coors.rateByH)
            );
        } else {
            this.service.moved(
                this.dock.id,
                Math.round(this.coors.top / this.coors.rateByH),
                Math.round(this.coors.left / this.coors.rateByW)
            );
        }
        this._cdRef.detectChanges();
    }

    private _onMouseUp(event: MouseEvent) {
        this._direction = null;
        this._unsubscribeToWinEvents();
        this._updateCoors();
        this.service.finishedManipulation(this.dock.id);
    }

    private _updateCoors() {
        const rateByH: number = this._height / this.dock.coor.r;
        const rateByW: number = this._width / this.dock.coor.c;
        this.coors = {
            top: this.dock.coor.t * rateByH,
            left: this.dock.coor.l * rateByW,
            width: this.dock.coor.w * rateByW,
            height: this.dock.coor.h * rateByH,
            rateByH: rateByH,
            rateByW: rateByW
        };
    }

    private _onResized(coor: Coor) {
        if (this.dock.id !== coor.id) {
            return;
        }
        this.coors.top = coor.t * this.coors.rateByH;
        this.coors.height = coor.h * this.coors.rateByH;
        this.coors.left = coor.l * this.coors.rateByW;
        this.coors.width = coor.w * this.coors.rateByW;
    }

    private _onMoved(coor: Coor) {
        if (this.dock.id !== coor.id) {
            return;
        }
        this.coors.top = coor.t * this.coors.rateByH;
        this.coors.left = coor.l * this.coors.rateByW;
    }

    private _onStartedManipulate(id: string) {
        if (this.dock.id === id) {
            return;
        }
        this.manipulation = true;
        this._cdRef.detectChanges();
    }

    private _onFinishedManipulate(id: string) {
        if (this.dock.id === id) {
            return;
        }
        this.manipulation = false;
        this._cdRef.detectChanges();
    }

    private _onResize(size: ISizeDocksArea) {
        this._height = size.height;
        this._width = size.width;
        this._updateCoors();
    }

}

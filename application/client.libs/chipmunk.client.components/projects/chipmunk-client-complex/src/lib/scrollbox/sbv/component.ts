// tslint:disable:max-line-length
// tslint:disable:no-inferrable-types
// tslint:disable:member-ordering
// tslint:disable:component-selector

import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, Input, AfterContentInit, HostListener } from '@angular/core';

export type TUpdateFunction = (offset: number, direction: number, outside: boolean) => void;
export type TGetRowsCount = () => number;
export type THandler = () => void;

@Component({
    selector: 'lib-complex-scrollbox-sbv',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ComplexScrollBoxSBVComponent implements OnDestroy, AfterContentInit {

    @Input() public rowHeight: number = 1;
    @Input() public update: TUpdateFunction = () => void 0;
    @Input() public getRowsCount: TGetRowsCount = () => void 0;
    @Input() public pgUp: THandler = () => void 0;
    @Input() public pgDown: THandler = () => void 0;

    private _rate: number = 0;
    private _rows: number = 0;
    private _height: number = 0;
    private _mouseY: number = -1;
    private _thumb: number = 0;
    private _offset: number = 0;
    private _start: number = -1;
    private _end: number = -1;
    private _count: number = 0;
    private _thumbUsage: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    @HostListener('click', ['$event'])

    public onClick(event: MouseEvent) {
        if (this._thumbUsage) {
            return;
        }
        if (event.offsetY < this._offset) {
            this.pgUp();
        } else if (event.offsetY > this._offset + this._thumb) {
            this.pgDown();
        }
    }

    public ngAfterContentInit() {
        this._count = this.getRowsCount();
        this._setHeight();
        this._update();
    }

    public ngOnDestroy() {
    }

    public _ng_onBrowserWindowResize(event?: Event) {
        this.recalc();
    }

    public _ng_getStyles(): { [key: string]: any } {
        return {
            height: `${this._thumb}px`,
            marginTop: `${this._offset}px`,
        };
    }

    public _ng_mouseDown(event: MouseEvent) {
        this._thumbUsage = true;
        this._mouseY = event.y;
        event.preventDefault();
        return false;
    }

    public _ng_mouseUp(event: MouseEvent) {
        if (this._mouseY === -1) {
            return;
        }
        this._mouseY = -1;
        event.preventDefault();
        setTimeout(() => {
            this._thumbUsage = false;
        }, 1);
        return false;
    }

    public _ng_mouseMove(event: MouseEvent) {
        if (this._mouseY === -1) {
            return;
        }
        const change: number = event.y - this._mouseY;
        if (change === 0) {
            return;
        }
        this._mouseY = event.y;
        this._setOffset(this._offset + change);
        this._cdRef.detectChanges();
        this.update(Math.abs(change / this._rate), change > 0 ? 1 : -1, true);
        event.preventDefault();
        return false;
    }

    public recalc() {
        this._setHeight();
        this._update();
        this.setFrame(this._start, this._end, this._count);
    }

    public setFrame(start: number, end: number, count: number) {
        this._start = start;
        this._end = end;
        if (count !== this._count) {
            this._count = count;
            this._setHeight();
            this._update();
        }
        const offset = (start / (this._count - this._rows)) * (this._height - this._thumb);
        if (Math.round(offset) === Math.round(this._offset)) {
            return;
        }
        this._setOffset(offset);
        this._cdRef.detectChanges();
    }

    private _update() {
        // Calculate scroll area height
        const full = this._count * this.rowHeight;
        // Calculate rate
        this._rate = this._height / full;
        if (this._rate > 1) {
            return this._cdRef.detectChanges();
        }
        // Calculate thumb height
        this._thumb = this._height * this._rate;
        if (this._thumb < 20) {
            this._thumb = 20;
        }
        // Update
        this._cdRef.detectChanges();
    }

    private _setOffset(offset: number) {
        this._offset = offset;
        if (this._offset < 0) {
            this._offset = 0;
        }
        if (this._offset > this._height - this._thumb) {
            this._offset = this._height - this._thumb;
        }
    }

    private _setHeight() {
        if (this._vcRef === undefined || this._vcRef === null) {
            return;
        }
        const size = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._height = size.height;
        this._rows = Math.floor(this._height / this.rowHeight);
    }

}


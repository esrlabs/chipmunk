// tslint:disable:max-line-length
// tslint:disable:no-inferrable-types
// tslint:disable:member-ordering
// tslint:disable:component-selector

import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, Input, AfterContentInit, HostListener, OnChanges } from '@angular/core';

export type TUpdateFunction = (offset: number) => void;
export type THandler = () => void;

@Component({
    selector: 'lib-complex-scrollbox-sbh',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ComplexScrollBoxSBHComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() public width: number = 0;
    @Input() public length: number = 0;
    @Input() public update: TUpdateFunction = () => void 0;
    @Input() public right: THandler = () => void 0;
    @Input() public left: THandler = () => void 0;

    private _mouseX: number = -1;
    private _thumb: number = 0;
    private _offset: number = 0;
    private _minOffset: number = 20;
    private _minStep: number = 10;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    @HostListener('click', ['$event'])

    public onClick(event: MouseEvent) {
        if (event.clientX < this._offset) {
            this.left();
        } else if (event.clientX > this._offset + this._thumb) {
            this.right();
        }
    }

    public ngOnChanges() {
        this._update();
        this._validate();
    }

    public ngAfterContentInit() {
        this._update();
    }

    public ngOnDestroy() {
    }

    public _ng_onBrowserWindowResize(event?: Event) {
        this._update();
    }

    public _ng_getStyles(): { [key: string]: any } {
        return {
            width: `${this._thumb}px`,
            marginLeft: `${this._offset}px`,
        };
    }

    public _ng_mouseDown(event: MouseEvent) {
        this._mouseX = event.x;
        event.preventDefault();
        return false;
    }

    public _ng_mouseUp(event: MouseEvent) {
        if (this._mouseX === -1) {
            return;
        }
        this._mouseX = -1;
        event.preventDefault();
        return false;
    }

    public _ng_mouseMove(event: MouseEvent) {
        if (this._mouseX === -1) {
            return;
        }
        const change: number = event.x - this._mouseX;
        if (change === 0) {
            return;
        }
        this._mouseX = event.x;
        this._setOffset(this._offset + change);
        this._cdRef.detectChanges();
        this.update(this._offset * ((this.length - this.width + this._minOffset) / (this.width - this._thumb)));
        event.preventDefault();
        return false;
    }

    public toLeft() {
        this._setOffset(this._offset - this._minStep);
        this.update(this._offset * ((this.length - this.width + this._minOffset) / (this.width - this._thumb)));
        this._cdRef.detectChanges();
    }

    public toRight() {
        this._setOffset(this._offset + this._minStep);
        this.update(this._offset * ((this.length - this.width + this._minOffset) / (this.width - this._thumb)));
        this._cdRef.detectChanges();
    }

    public setOffset(margin: number) {
        this._offset = margin / ((this.length - this.width + this._minOffset) / (this.width - this._thumb));
        this._cdRef.detectChanges();
    }

    public getMinOffset(): number {
        return this._minOffset;
    }

    private _setOffset(offset: number) {
        this._offset = offset;
        if (this._offset < 0) {
            this._offset = 0;
        }
        if (this._offset > this.width - this._thumb) {
            this._offset = this.width - this._thumb;
        }
    }

    private _update() {
        const thumb: number = (this.width / this.length) * this.width;
        this._thumb = thumb < 20 ? 20 : thumb;
        this._cdRef.detectChanges();
    }

    private _validate() {
        if (this._offset + this._thumb < this.width) {
            return;
        }
        this._offset = this.width - this._thumb;
        this.update(this._offset * ((this.length - this.width + this._minOffset) / (this.width - this._thumb)));
        this._cdRef.detectChanges();
    }

}


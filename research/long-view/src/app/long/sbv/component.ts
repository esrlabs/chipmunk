// tslint:disable:max-line-length
// tslint:disable:no-inferrable-types
// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Subject } from 'rxjs';

export type TUpdateFunction = (offset: number, direction: number) => void;
@Component({
    selector: 'app-lib-complex-infinity-output-sbv',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ComplexInfinityOutputSBVComponent implements OnDestroy, AfterContentInit {

    @Input() public rowsCount: number = 1;
    @Input() public rowHeight: number = 1;
    @Input() public update: TUpdateFunction = () => void 0;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    private _rate: number = 0;
    private _height: number = 0;
    private _mouseY: number = -1;
    private _thumb: number = 0;
    private _offset: number = 0;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngAfterContentInit() {
        this._setHeight();
        this._update();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_getStyles(): { [key: string]: any } {
        return {
            height: `${this._thumb}px`,
            marginTop: `${this._offset}px`,
        };
    }

    public _ng_svb_mouseDown(event: MouseEvent) {
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
        return false;
    }

    public _ng_mouseMove(event: MouseEvent) {
        if (this._mouseY === -1) {
            return;
        }
        const change: number = event.y - this._mouseY;
        this._mouseY = event.y;
        this._offset += change;
        if (this._offset < 0) {
            this._offset = 0;
        }
        if (this._offset > this._height - this._thumb) {
            this._offset = this._height - this._thumb;
        }
        this._cdRef.detectChanges();
        this.update(Math.abs(change / this._rate), change > 0 ? 1 : -1);
        event.preventDefault();
        return false;
    }

    private _update() {
        // Calculate scroll area height
        const full = this.rowsCount * this.rowHeight;
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

    private _setHeight() {
        if (this._vcRef === undefined || this._vcRef === null) {
            return;
        }
        const size = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._height = size.height;
    }

}


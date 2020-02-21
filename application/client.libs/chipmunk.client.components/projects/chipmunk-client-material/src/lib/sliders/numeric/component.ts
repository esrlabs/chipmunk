// tslint:disable:member-ordering
import { Component, Input, AfterContentInit, AfterViewInit, ChangeDetectorRef,
         OnChanges, SimpleChanges, OnDestroy, ViewChild, ElementRef } from '@angular/core';

declare class ResizeObserver {
    constructor(callback: ResizeObserverCallback);
    disconnect(): void;
    observe(target: Element): void;
    unobserve(target: Element): void;
}

type ResizeObserverCallback = (entries: ReadonlyArray<ResizeObserverEntry>) => void;

interface ResizeObserverEntry {
    readonly target: Element;
    readonly contentRect: DOMRectReadOnly;
}

@Component({
    selector: 'lib-primitive-numeric-slider',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SliderNumericComponent implements AfterContentInit, OnChanges, AfterViewInit, OnDestroy {

    @ViewChild('line', {static: false}) private _lineElRef: ElementRef;

    public _ng_value: number = 0;
    public _ng_min: number = 0;
    public _ng_max: number = 0;

    @Input() public value: number = 0;
    @Input() public min: number = 0;
    @Input() public max: number = 100;
    @Input() public step: number = 1;
    @Input() public onChange: (value: string | number, event?: KeyboardEvent) => any = () => void 0;

    private _x: number | undefined;
    private _width: number = 1;
    private _destroyed: boolean = false;
    private _resizeObserver: ResizeObserver;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this._resizeObserver = new ResizeObserver(this._onResize.bind(this));
    }

    public ngOnDestroy() {
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        this._resizeObserver.disconnect();
        this._destroyed = true;
    }

    public ngAfterContentInit() {
        if (typeof this.value !== 'number') {
            return;
        }
        this._ng_value = this.value;
        this._ng_min = this.min;
        this._ng_max = this.max;
        this._forceUpadte();
    }

    public ngAfterViewInit() {
        if (this._lineElRef === undefined) {
            return;
        }
        this._resizeObserver.observe(this._lineElRef.nativeElement);
        this._resize();
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.value !== undefined) {
            this.value = changes.value.currentValue;
            this._ng_value = this.value;
        }
        if (changes.min !== undefined) {
            this.min = changes.min.currentValue;
        }
        if (changes.max !== undefined) {
            this.max = changes.max.currentValue;
        }
        this._forceUpadte();
    }

    public drop() {
        this._ng_value = this.min;
    }

    public refresh() {
        this._onChange();
    }

    public setValue(value: number, silence: boolean = false) {
        this._ng_value = value;
        if (silence) {
            this._forceUpadte();
        } else {
            this._onChange();
        }
    }

    public getValue(): string | number {
        return this._ng_value;
    }

    public _ng_getCursorLeft(): string {
        const steps: number = (this._ng_max - this._ng_min) / this.step;
        const stepPx: number = this._width / steps;
        const left: number = (this._ng_value / this.step) - (this._ng_min === 0 ? 0 : 1);
        const offset: number = left * stepPx;
        return offset + 'px';
    }

    public _ng_onMouseDown(event: MouseEvent) {
        this._resize();
        this._x = event.x;
    }

    private _onMouseMove(event: MouseEvent) {
        if (this._x === undefined) {
            return;
        }
        const offset: number = event.x - this._x;
        if (offset > 0 && this._ng_value === this._ng_max) {
            return;
        }
        if (offset < 0 && this._ng_value === this._ng_min) {
            return;
        }
        const steps: number = (this._ng_max - this._ng_min) / this.step;
        const stepPx: number = this._width / steps;
        const left: number = Math.round(this._ng_value / this.step) - (this._ng_min === 0 ? 0 : 1);
        const leftPx: number = stepPx * left;
        let leftPxUpdated: number = leftPx + offset;
        if (offset > 0) {
            leftPxUpdated += stepPx / 2;
        } else {
            leftPxUpdated -= stepPx / 2;
        }
        leftPxUpdated = leftPxUpdated < 0 ? 0 : leftPxUpdated;
        leftPxUpdated = leftPxUpdated > this._width ? this._width : leftPxUpdated;
        let leftUpdated: number = 0;
        if (offset > 0) {
            leftUpdated = Math.floor(leftPxUpdated / stepPx);
        } else {
            leftUpdated = Math.ceil(leftPxUpdated / stepPx);
        }
        if (leftUpdated === left) {
            return;
        }
        this._x = event.x;
        if (offset > 0) {
            this._x += stepPx / 2;
        } else {
            this._x -= stepPx / 2;
        }
        this._ng_value = this._ng_min + this.step * leftUpdated;
        if (this._ng_value - Math.floor(this._ng_value) !== 0) {
            this._ng_value = parseFloat(this._ng_value.toFixed(2));
        }
        this._onChange();
    }

    private _onMouseUp(event: MouseEvent) {
        if (this._x === undefined) {
            return;
        }
        this._x = undefined;
    }

    private _onChange() {
        this.onChange(this._ng_value, undefined);
        this._forceUpadte();
    }

    private _onResize(entries: ResizeObserverEntry[]) {
        if (entries.length === 0) {
            return;
        }
        this._resize(entries[0].contentRect.width);
        this._forceUpadte();
    }

    private _resize(width?: number) {
        if (width !== undefined) {
            this._width = width;
            return;
        }
        if (this._lineElRef === undefined) {
            return;
        }
        const size: ClientRect = (this._lineElRef.nativeElement as HTMLElement).getBoundingClientRect();
        this._width = size.width;
    }

    private _forceUpadte() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}

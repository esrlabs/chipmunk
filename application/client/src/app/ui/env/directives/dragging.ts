import {
    AfterViewInit,
    Directive,
    ElementRef,
    OnDestroy,
    HostListener,
    Input,
    Output,
    EventEmitter,
} from '@angular/core';
import { stop } from '@ui/env/dom';

export interface ChangeEvent {
    top: number;
    left: number;
}
@Directive({
    selector: '[appDragging]',
})
export class DraggingDirective implements AfterViewInit, OnDestroy {
    @Input() public min: {
        top: number;
        left: number;
    } = {
        top: 0,
        left: 0,
    };

    @Input() public max: {
        top: number;
        left: number;
    } = {
        top: 0,
        left: 0,
    };
    @Input() public top!: number;
    @Input() public left!: number;
    @Output() changed = new EventEmitter<ChangeEvent>();

    protected readonly position: {
        top: number;
        left: number;
    } = {
        top: -1,
        left: -1,
    };

    constructor(private _hostElement: ElementRef) {
        this._mousemove = this._mousemove.bind(this);
        this._mouseup = this._mouseup.bind(this);
        window.addEventListener('mousemove', this._mousemove);
        window.addEventListener('mouseup', this._mouseup);
    }

    @HostListener('mousedown', ['$event']) _mousedown(event: MouseEvent) {
        this.position.top = event.y;
        this.position.left = event.x;
    }

    public ngAfterViewInit() {
        (this._hostElement.nativeElement as HTMLElement).focus();
    }

    public ngOnDestroy(): void {
        window.removeEventListener('mousemove', this._mousemove);
        window.removeEventListener('mouseup', this._mouseup);
    }

    private _mousemove(event: MouseEvent) {
        if (this.position.top === -1 || this.position.left === -1) {
            return;
        }
        const diff = {
            left: event.x - this.position.left,
            top: event.y - this.position.top,
        };
        this.top += diff.top;
        this.left += diff.left;
        if (this.top > this.max.top && this.max.top !== -1) {
            this.top = this.max.top;
        } else if (this.top < this.min.top && this.min.top !== -1) {
            this.top = this.min.top;
        }
        if (this.left > this.max.left && this.max.left !== -1) {
            this.left = this.max.left;
        } else if (this.left < this.min.left && this.min.left !== -1) {
            this.left = this.min.left;
        }
        this.position.top = event.y;
        this.position.left = event.x;
        stop(event);
        this.changed.emit({ top: this.top, left: this.left });
    }

    private _mouseup(event: MouseEvent) {
        this._mousemove(event);
        this.position.top = -1;
        this.position.left = -1;
    }
}

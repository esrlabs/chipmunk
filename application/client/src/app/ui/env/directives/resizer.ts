import {
    AfterViewInit,
    Directive,
    HostBinding,
    ElementRef,
    OnDestroy,
    HostListener,
    Input,
    Output,
    EventEmitter,
} from '@angular/core';
import { Subject } from '@platform/env/subscription';
import { stop } from '@ui/env/dom';
import { NormalizedBackgroundTask } from '@platform/env/normalized';

export enum Direction {
    Vertical = 'Vertical',
    Horizontal = 'Horizontal',
}

const UPDATE_DELAY_MS = 20;

@Directive({
    selector: '[appResizer]',
})
export class ResizerDirective implements AfterViewInit, OnDestroy {
    @Input() public direction!: Direction;
    @Input() public min: number = -1;
    @Input() public max: number = -1;
    @Input() public size!: number;
    @Input() public corrector: number = 1;
    @Input() public resized: Subject<number> | undefined;
    @Output() changesize = new EventEmitter<number>();

    protected position: number = -1;
    protected readonly runner: NormalizedBackgroundTask = new NormalizedBackgroundTask(
        UPDATE_DELAY_MS,
    );

    constructor(private _hostElement: ElementRef) {
        this._mousemove = this._mousemove.bind(this);
        this._mouseup = this._mouseup.bind(this);
    }

    @HostListener('mousedown', ['$event']) _mousedown(event: MouseEvent) {
        this.position = this._getPos(event);
        this.listeners().bind();
    }

    @HostBinding('class.dragging') get dragging() {
        return this.position !== -1;
    }

    public ngAfterViewInit() {
        (this._hostElement.nativeElement as HTMLElement).focus();
    }

    public ngOnDestroy(): void {
        this.listeners().unbind();
        this.runner.abort();
    }

    private _mousemove(event: MouseEvent) {
        if (this.position === -1) {
            return;
        }
        const diff = this._getPos(event) - this.position;
        this.size -= diff * this.corrector;
        if (this.size > this.max && this.max !== -1) {
            this.size = this.max;
        } else if (this.size < this.min && this.min !== -1) {
            this.size = this.min;
        }
        this.position = this._getPos(event);
        stop(event);
        this.runner.run(() => {
            if (this.resized !== undefined) {
                this.resized.emit(this.size);
            } else {
                this.changesize.emit(this.size);
            }
        });
    }

    private _mouseup(event: MouseEvent) {
        this._mousemove(event);
        this.position = -1;
        this.listeners().unbind();
    }

    private _getPos(event: MouseEvent): number {
        return this.direction === Direction.Horizontal ? event.x : event.y;
    }

    protected listeners(): {
        bind(): void;
        unbind(): void;
    } {
        return {
            bind: (): void => {
                window.addEventListener('mousemove', this._mousemove);
                window.addEventListener('mouseup', this._mouseup);
            },
            unbind: (): void => {
                window.removeEventListener('mousemove', this._mousemove);
                window.removeEventListener('mouseup', this._mouseup);
            },
        };
    }
}

import {
    AfterViewInit,
    Directive,
    ElementRef,
    OnDestroy,
    Output,
    EventEmitter,
} from '@angular/core';

export enum Direction {
    Vertical = 'Vertical',
    Horizontal = 'Horizontal',
}

@Directive({
    selector: '[appResizeObserver]',
})
export class ResizeObserverDirective implements AfterViewInit, OnDestroy {
    @Output() changesize = new EventEmitter<DOMRect>();
    private _hostElement!: HTMLElement;
    private _domRect!: DOMRect;
    private _resizeObserve: ResizeObserver | undefined;

    constructor(hostElement: ElementRef<HTMLElement>) {
        this._hostElement = hostElement.nativeElement;
    }

    public ngAfterViewInit() {
        if (this._resizeObserve !== undefined) {
            throw new Error(`Holder cannot be bound muliple times`);
        }
        this._resizeObserve = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            if (entries.length !== 1) {
                return;
            }
            this._detect(entries[0].contentRect);
        });
        this._resizeObserve.observe(this._hostElement);
        this._detect(this._hostElement.getBoundingClientRect());
    }

    public ngOnDestroy(): void {
        if (this._resizeObserve !== undefined) {
            this._resizeObserve.unobserve(this._hostElement);
        }
    }

    private _detect(rect: DOMRect) {
        const changed =
            this._domRect === undefined
                ? true
                : rect.height !== this._domRect.height || rect.width !== this._domRect.width;
        this._domRect = rect;
        changed && this.changesize.emit(rect);
    }
}

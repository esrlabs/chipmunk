import {
    AfterViewInit,
    Directive,
    ElementRef,
    OnDestroy,
    Output,
    EventEmitter,
} from '@angular/core';
import { NormalizedBackgroundTask } from '@platform/env/normalized';

const UPDATE_DELAY_MS = 20;

@Directive({
    selector: '[appResizeObserver]',
})
export class ResizeObserverDirective implements AfterViewInit, OnDestroy {
    @Output() changesize = new EventEmitter<DOMRect>();

    protected hostElement!: HTMLElement;
    protected domRect!: DOMRect;
    protected resizeObserve: ResizeObserver | undefined;
    protected readonly runner: NormalizedBackgroundTask = new NormalizedBackgroundTask(
        UPDATE_DELAY_MS,
    );
    constructor(hostElement: ElementRef<HTMLElement>) {
        this.hostElement = hostElement.nativeElement;
    }

    public ngAfterViewInit() {
        if (this.resizeObserve !== undefined) {
            throw new Error(`Holder cannot be bound muliple times`);
        }
        this.resizeObserve = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            if (entries.length !== 1) {
                return;
            }
            this._detect(entries[0].contentRect);
        });
        this.resizeObserve.observe(this.hostElement);
        this._detect(this.hostElement.getBoundingClientRect());
    }

    public ngOnDestroy(): void {
        if (this.resizeObserve !== undefined) {
            this.resizeObserve.unobserve(this.hostElement);
        }
        this.runner.abort();
    }

    private _detect(rect: DOMRect) {
        const changed =
            this.domRect === undefined
                ? true
                : rect.height !== this.domRect.height || rect.width !== this.domRect.width;
        this.domRect = rect;
        changed &&
            this.runner.run(() => {
                this.changesize.emit(rect);
            });
    }
}

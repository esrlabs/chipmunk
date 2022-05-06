import { ElementRef } from '@angular/core';
import { Subscription, Subject } from '@platform/env/subscription';

export class Holder {
    private _elementRef!: HTMLElement;
    private _domRect!: DOMRect;
    private readonly _subjects: {
        change: Subject<number>;
    } = {
        change: new Subject<number>(),
    };
    private _resizeObserve: ResizeObserver | undefined;

    public destroy() {
        if (this._resizeObserve !== undefined) {
            this._resizeObserve.unobserve(this._elementRef);
        }
        this._subjects.change.destroy();
    }

    public bind(elementRef: ElementRef<HTMLElement>) {
        if (this._resizeObserve !== undefined) {
            throw new Error(`Holder cannot be bound muliple times`);
        }
        this._resizeObserve = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            if (entries.length !== 1) {
                return;
            }
            this._detect(entries[0].contentRect);
        });
        this._elementRef = elementRef.nativeElement;
        this._resizeObserve.observe(this._elementRef);
        this._detect(this._elementRef.getBoundingClientRect());
    }

    public getHeight(): number {
        return this._domRect.height;
    }

    public onHeightChange(handler: (height: number) => void): Subscription {
        return this._subjects.change.subscribe(handler);
    }

    private _detect(rect: DOMRect) {
        const changed = this._domRect === undefined ? true : rect.height !== this._domRect.height;
        this._domRect = rect;
        changed && this._subjects.change.emit(this._domRect.height);
    }
}

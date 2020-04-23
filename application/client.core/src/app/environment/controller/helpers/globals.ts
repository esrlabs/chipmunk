

export {};

declare global {

    class ResizeObserver {
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
}

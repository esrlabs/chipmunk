import { Subscription } from '@platform/env/subscription';

export function addEventListener(
    event: string,
    handler: (...args: any[]) => void,
    capture: boolean,
    target?: { addEventListener: (...args: any[]) => void },
): Subscription {
    target = target === undefined ? window : target;
    if (typeof target.addEventListener !== 'function') {
        throw new Error(`Target doesn't have addEventListener function`);
    }
    const control = new AbortController();
    target.addEventListener(event, handler, {
        capture,
        signal: control.signal,
    });
    return new Subscription(event, () => {
        control.abort();
    });
}

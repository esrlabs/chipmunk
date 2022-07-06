import { unique } from '@platform/env/sequence';
import { Handler } from './handler';
import { Subscription } from '@platform/env/subscription';
import { IOptions } from './options';

export interface ITarget {
    addEventListener: (...args: any[]) => void;
}

export class Target {
    static KEY = '___GLOBAL_LISTENER_UUID_TARGET___';
    public readonly uuid: string = unique();

    protected handlers: Map<string, Map<string, Handler<unknown>>> = new Map();
    protected signals: Map<string, AbortController> = new Map();
    protected target: ITarget;

    constructor(target: ITarget) {
        this.target = target;
        (this.target as any)[Target.KEY] = this.uuid;
    }

    public destroy(): void {
        this.handlers.clear();
        this.signals.forEach((controller) => controller.abort());
        this.signals.clear();
    }

    public equal(target: ITarget): boolean {
        return (target as any)[Target.KEY] === this.uuid;
    }

    public listen<T>(
        event: string,
        handler: (event: T) => boolean,
        options?: IOptions,
    ): Subscription {
        if (event.trim() === '') {
            throw new Error(`Invalid event name`);
        }
        let handlers = this.handlers.get(event);
        if (handlers === undefined) {
            const control = new AbortController();
            this.target.addEventListener(event, this.process.bind(this, event), {
                capture: true,
                signal: control.signal,
            });
            this.signals.set(event, control);
            handlers = new Map();
        }
        const instance = new Handler<T>(handler, options);
        const uuid = instance.uuid;
        handlers.set(uuid, instance as Handler<unknown>);
        this.handlers.set(event, handlers);
        return new Subscription(`event: ${uuid}`, () => {
            const handlers = this.handlers.get(event);
            if (handlers === undefined) {
                return;
            }
            handlers.delete(uuid);
            this.handlers.set(event, handlers);
            if (handlers.size === 0) {
                this.handlers.delete(event);
                const signal = this.signals.get(event);
                if (signal !== undefined) {
                    signal.abort();
                }
                this.signals.delete(event);
            }
        });
    }

    protected process(name: string, event: unknown): boolean {
        const handlers = this.handlers.get(name);
        if (handlers === undefined) {
            return true;
        }
        const sorted = Array.from(handlers.values());
        sorted.sort((a, b) => {
            return a.priority > b.priority ? -1 : 1;
        });
        let result = true;
        sorted.forEach((handler) => {
            if (!result) {
                return;
            }
            result = handler.proccess(event);
        });
        if (!result) {
            const untyped = event as any;
            ['preventDefault', 'stopImmediatePropagation', 'stopPropagation'].forEach(
                (alias: string) => {
                    typeof untyped[alias] === 'function' && untyped[alias]();
                },
            );
        }
        return result;
    }
}

export function getTargetUuid(target: ITarget): string | undefined {
    return (target as any)[Target.KEY];
}

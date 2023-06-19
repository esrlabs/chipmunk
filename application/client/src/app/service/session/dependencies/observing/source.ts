import { ObserveOperation } from './operation';
import { Observe } from '@platform/types/observe';

export class ObserveSource {
    public readonly observe: Observe;
    public readonly observer: ObserveOperation | undefined;

    constructor(observe: Observe, observer?: ObserveOperation) {
        this.observe = observe;
        this.observer = observer;
    }

    public uuid(): string {
        return this.observe.uuid;
    }

    public isSame(source: ObserveSource): boolean {
        return this.uuid() === source.uuid();
    }
}

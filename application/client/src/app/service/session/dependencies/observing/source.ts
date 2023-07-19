import { ObserveOperation } from './operation';
import { Observe } from '@platform/types/observe';
import { Mutable } from '@platform/types/unity/mutable';

export class ObserveSource {
    public readonly observe: Observe;
    public readonly observer: ObserveOperation | undefined;
    public readonly child: boolean = false;

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

    public asChild(): ObserveSource {
        (this as Mutable<ObserveSource>).child = true;
        return this;
    }
}

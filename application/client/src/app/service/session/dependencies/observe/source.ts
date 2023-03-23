import { ObserveOperation } from './operation';
import { DataSource } from '@platform/types/observe';

export class ObserveSource {
    public readonly source: DataSource;
    public readonly observer: ObserveOperation | undefined;

    constructor(source: DataSource, observer?: ObserveOperation) {
        this.source = source;
        this.observer = observer;
    }

    public uuid(): string {
        return this.source.uuid;
    }

    public isSame(source: ObserveSource): boolean {
        return this.uuid() === source.uuid();
    }
}

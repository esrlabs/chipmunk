import { ObserveOperation } from '@service/session/dependencies/observe/operation';
import { DataSource } from '@platform/types/observe';

export class SourceHolder {
    public readonly source: DataSource;
    public readonly observer: ObserveOperation | undefined;

    constructor(source: DataSource, observer?: ObserveOperation) {
        this.source = source;
        this.observer = observer;
    }

    public uuid(): string {
        return this.source.uuid;
    }

    public isSame(holder: SourceHolder): boolean {
        return this.uuid() === holder.uuid();
    }
}

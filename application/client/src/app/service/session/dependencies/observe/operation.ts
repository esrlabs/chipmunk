import { DataSource } from '@platform/types/observe';

export class ObserveOperation {
    protected readonly uuid: string;
    protected readonly source: DataSource;
    protected readonly cancel: (uuid: string) => Promise<void>;

    constructor(uuid: string, source: DataSource, cancel: (uuid: string) => Promise<void>) {
        this.uuid = uuid;
        this.source = source;
        this.cancel = cancel;
    }

    public abort(): Promise<void> {
        return this.cancel(this.uuid);
    }

    public asSource(): DataSource {
        return this.source;
    }
}

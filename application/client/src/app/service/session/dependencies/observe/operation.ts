import { DataSource } from '@platform/types/observe';

export class ObserveOperation {
    protected readonly uuid: string;
    protected readonly source: DataSource;
    protected readonly cancel: (uuid: string) => Promise<void>;
    protected readonly restarting: (uuid: string, source: DataSource) => Promise<void>;
    protected readonly sde: <T, R>(uuid: string, msg: T) => Promise<R>;

    constructor(
        uuid: string,
        source: DataSource,
        sde: <T, R>(uuid: string, msg: T) => Promise<R>,
        restart: (uuid: string, source: DataSource) => Promise<void>,
        cancel: (uuid: string) => Promise<void>,
    ) {
        this.uuid = uuid;
        this.source = source;
        this.cancel = cancel;
        this.restarting = restart;
        this.sde = sde;
    }

    public abort(): Promise<void> {
        return this.cancel(this.uuid);
    }

    public restart(): Promise<void> {
        return this.restarting(this.uuid, this.source);
    }

    public asSource(): DataSource {
        return this.source;
    }

    public sendIntoSde<T, R>(msg: T): Promise<R> {
        return this.sde<T, R>(this.uuid, msg);
    }
}

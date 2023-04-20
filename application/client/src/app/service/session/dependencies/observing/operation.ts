import { DataSource } from '@platform/types/observe';
import { SdeRequest, SdeResponse } from '@platform/types/sde';

export class ObserveOperation {
    public readonly uuid: string;
    protected readonly source: DataSource;
    protected readonly cancel: () => Promise<void>;
    protected readonly restarting: (source: DataSource) => Promise<void>;
    protected readonly sde: (msg: SdeRequest) => Promise<SdeResponse>;

    private _sdeTasksCount: number = 0;

    constructor(
        uuid: string,
        source: DataSource,
        sde: (msg: SdeRequest) => Promise<SdeResponse>,
        restart: (source: DataSource) => Promise<void>,
        cancel: () => Promise<void>,
    ) {
        this.uuid = uuid;
        this.source = source;
        this.cancel = cancel;
        this.restarting = restart;
        this.sde = sde;
    }

    public abort(): Promise<void> {
        return this.cancel();
    }

    public restart(): Promise<void> {
        return this.restarting(this.source);
    }

    public asSource(): DataSource {
        return this.source;
    }

    public send(): {
        text(data: string): Promise<SdeResponse>;
        bytes(data: number[]): Promise<SdeResponse>;
    } {
        const send = (request: SdeRequest): Promise<SdeResponse> => {
            this._sdeTasksCount += 1;
            return this.sde(request).finally(() => {
                this._sdeTasksCount -= 1;
            });
        };
        const isSupported = (): boolean => {
            if (this.source.is().process || this.source.is().serial) {
                return true;
            }
            return false;
        };
        return {
            text: (data: string): Promise<SdeResponse> => {
                if (!isSupported()) {
                    return Promise.reject(new Error(`Data source doesn't support SDE protocol`));
                }
                return send({
                    WriteText: `${data}\n`,
                });
            },
            bytes: (data: number[]): Promise<SdeResponse> => {
                if (!isSupported()) {
                    return Promise.reject(new Error(`Data source doesn't support SDE protocol`));
                }
                return send({
                    WriteBytes: data,
                });
            },
        };
    }

    public getSdeTasksCount(): number {
        return this._sdeTasksCount;
    }
}

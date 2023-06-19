import { Observe } from '@platform/types/observe';
import { SdeRequest, SdeResponse } from '@platform/types/sde';

import * as $ from '@platform/types/observe';

export class ObserveOperation {
    private _sdeTasksCount: number = 0;

    constructor(
        public readonly uuid: string,
        protected readonly observe: Observe,
        protected readonly sde: (msg: SdeRequest) => Promise<SdeResponse>,
        protected readonly restarting: (observe: Observe) => Promise<string>,
        protected readonly cancel: () => Promise<void>,
    ) {}

    public abort(): Promise<void> {
        return this.cancel();
    }

    public restart(): Promise<string> {
        return this.restarting(this.observe);
    }

    public asObserve(): Observe {
        return this.observe;
    }

    public asOrigin(): $.Origin.Configuration {
        return this.observe.origin;
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
        return {
            text: (data: string): Promise<SdeResponse> => {
                if (!this.observe.origin.isSdeSupported()) {
                    return Promise.reject(
                        new Error(`Observed origin doesn't support SDE protocol`),
                    );
                }
                return send({
                    WriteText: `${data}\n`,
                });
            },
            bytes: (data: number[]): Promise<SdeResponse> => {
                if (!this.observe.origin.isSdeSupported()) {
                    return Promise.reject(
                        new Error(`Observed origin doesn't support SDE protocol`),
                    );
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

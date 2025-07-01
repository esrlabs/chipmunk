import { SdeRequest, SdeResponse } from '@platform/types/sde';
import { SessionSetup, SessionDescriptor } from '@platform/types/bindings';
import { SessionOrigin } from '@service/session/origin';

type SdeAPIFunc = (msg: SdeRequest) => Promise<SdeResponse>;
type RestartingAPIFunc = (setup: SessionOrigin) => Promise<string>;
type CancelAPIFunc = () => Promise<void>;

export enum State {
    Started,
    Running,
    Done,
}

export class ObserveOperation {
    protected _sdeTasksCount: number = 0;

    protected descriptor: SessionDescriptor | undefined;
    protected sde: SdeAPIFunc | undefined;
    protected restarting: RestartingAPIFunc | undefined;
    protected cancel: CancelAPIFunc | undefined;
    protected origin: SessionOrigin | undefined;

    public state: State = State.Started;

    constructor(public readonly uuid: string) {}

    public bind(
        origin: SessionOrigin,
        sde: SdeAPIFunc,
        restarting: RestartingAPIFunc,
        cancel: CancelAPIFunc,
    ) {
        this.origin = origin;
        this.sde = sde;
        this.restarting = restarting;
        this.cancel = cancel;
        this.state = State.Running;
    }

    public abort(): Promise<void> {
        if (!this.cancel) {
            return Promise.reject(
                new Error(`"abort" cannot be called, because ObserveOperation isn't bound`),
            );
        }
        return this.cancel();
    }

    public restart(): Promise<string> {
        if (!this.restarting || !this.origin) {
            return Promise.reject(
                new Error(`"restart" cannot be called, because ObserveOperation isn't bound`),
            );
        }
        return this.restarting(this.origin);
    }

    public finish() {
        this.state = State.Done;
    }

    public isRunning(): boolean {
        return this.state === State.Running;
    }

    public isSame(operation: ObserveOperation): boolean {
        return this.uuid === operation.uuid;
    }

    public getOrigin(): SessionOrigin {
        if (!this.origin) {
            throw new Error(`Operation ${this.uuid} isn't bound yet.`);
        }
        return this.origin;
    }

    public setDescriptor(descriptor: SessionDescriptor) {
        this.descriptor = descriptor;
    }

    public getDescriptor(): SessionDescriptor | undefined {
        return this.descriptor;
    }

    public send(): {
        text(data: string): Promise<SdeResponse>;
        bytes(data: number[]): Promise<SdeResponse>;
    } {
        const send = (request: SdeRequest): Promise<SdeResponse> => {
            if (!this.sde) {
                return Promise.reject(
                    new Error(`"sde" cannot be called, because ObserveOperation isn't bound`),
                );
            }
            this._sdeTasksCount += 1;
            return this.sde(request).finally(() => {
                this._sdeTasksCount -= 1;
            });
        };
        return {
            text: async (data: string): Promise<SdeResponse> => {
                if (!this.origin) {
                    return Promise.reject(
                        new Error(
                            `"sde::send::text" cannot be called, because ObserveOperation isn't bound`,
                        ),
                    );
                }
                const support = await this.origin.isSdeSupported();
                if (!support) {
                    return Promise.reject(
                        new Error(`Observed origin doesn't support SDE protocol`),
                    );
                }
                return send({
                    WriteText: `${data}\n\r`,
                });
            },
            bytes: async (data: number[]): Promise<SdeResponse> => {
                if (!this.origin) {
                    return Promise.reject(
                        new Error(
                            `"sde::send::bytes" cannot be called, because ObserveOperation isn't bound`,
                        ),
                    );
                }
                const support = await this.origin.isSdeSupported();
                if (!support) {
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

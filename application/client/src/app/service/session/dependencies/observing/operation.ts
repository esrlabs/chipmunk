import { SdeRequest, SdeResponse } from '@platform/types/sde';
import { SessionDescriptor, SourceDefinition } from '@platform/types/bindings';
import { SessionOrigin } from '@service/session/origin';
import { Subject } from '@platform/env/subscription';

type SdeAPIFunc = (msg: SdeRequest) => Promise<SdeResponse>;
type RestartingAPIFunc = (setup: SessionOrigin) => Promise<string>;
type CancelAPIFunc = () => Promise<void>;

export enum State {
    Started = 'started',
    Running = 'running',
    Done = 'finished',
    Aborted = 'aborted',
}

export class ObserveOperation {
    protected _sdeTasksCount: number = 0;

    protected descriptor: SessionDescriptor | undefined;
    protected sde: SdeAPIFunc | undefined;
    protected restarting: RestartingAPIFunc | undefined;
    protected cancel: CancelAPIFunc | undefined;
    protected origin: SessionOrigin | undefined;
    protected sources: Map<number, SourceDefinition> = new Map();

    public state: State = State.Started;
    public stateUpdateEvent: Subject<void> = new Subject();

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
        this.stateUpdateEvent.emit();
    }

    public addSource(source: SourceDefinition): boolean {
        if (this.sources.has(source.id)) {
            return false;
        }
        this.sources.set(source.id, source);
        return true;
    }

    public getSourcesCount(): number {
        return this.sources.size;
    }

    public getSource(id: number): SourceDefinition | undefined {
        return this.sources.get(id);
    }

    public getFirstSourceKey(): number | undefined {
        return this.sources.keys().next().value;
    }

    public destroy() {
        this.stateUpdateEvent.destroy();
    }

    public abort(): Promise<void> {
        if (this.state === State.Aborted || this.state === State.Done) {
            return Promise.resolve();
        }
        if (!this.cancel) {
            return Promise.reject(
                new Error(`"abort" cannot be called, because ObserveOperation isn't bound`),
            );
        }
        return this.cancel().finally(() => {
            this.state = State.Aborted;
            this.stateUpdateEvent.emit();
        });
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
        this.stateUpdateEvent.emit();
    }

    public isRunning(): boolean {
        return this.state === State.Running;
    }

    public isStopped(): boolean {
        return this.state === State.Done || this.state == State.Aborted;
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

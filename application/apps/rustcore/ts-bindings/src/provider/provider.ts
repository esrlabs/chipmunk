/// 1. All RUST public methods should have operation ID
/// 2. In Summary (test) we should highlight link between operation caller and operation done event;
///    we should show IDs
/// 3. Add performance test (grabbing)

import { Subject, validateEventDesc } from 'platform/env/subscription';
import { error } from 'platform/log/utils';
import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { TEventEmitter } from '../provider/provider.general';

export interface IOrderStat {
    type: 'E' | 'O';
    name: string;
    id: string | undefined;
    emitted: number; // Time of emitting event or operation
    duration: number;
}
export abstract class Computation<TEvents, IEventsSignatures, IEventsInterfaces> {
    private _destroyed: boolean = false;
    protected readonly uuid: string;
    protected readonly tracking: {
        subjects: {
            unsupported: Subject<string>;
            error: Subject<string>;
        };
        stat: {
            alias: string | undefined;
            unsupported: string[];
            error: string[];
            counter: { [key: string]: number };
            order: IOrderStat[];
            operations: { [key: string]: number };
        };
        track: boolean;
        store: boolean;
        count: boolean;
    } = {
        subjects: {
            unsupported: new Subject<string>(),
            error: new Subject<string>(),
        },
        stat: {
            alias: undefined,
            unsupported: [],
            error: [],
            counter: {},
            order: [],
            operations: {},
        },
        track: false,
        store: false,
        count: false,
    };
    protected readonly decoder: (buf: Uint8Array) => any;
    public readonly logger: Logger;

    constructor(uuid: string, decoder: (buf: Uint8Array) => any) {
        this.uuid = uuid;
        this.decoder = decoder;
        this._emitter = this._emitter.bind(this);
        this.logger = scope.getLogger(`${this.getName()}: ${uuid}`);
    }

    public destroy(): Promise<void> {
        if (this._destroyed) {
            this.logger.warn(`Computation (${this.uuid}) is already destroying or destroyed`);
        } else {
            this._destroy();
        }
        return Promise.resolve();
    }

    public abstract getName(): string;

    public abstract getEvents(): TEvents;

    public abstract getEventsSignatures(): IEventsSignatures;

    public abstract getEventsInterfaces(): IEventsInterfaces;

    public abstract getConvertor<T, O>(event: string, data: T): T | O | Error;

    public debug(): {
        getEvents(): {
            unsupported: Subject<string>;
            error: Subject<string>;
        };
        isTracking(): boolean;
        isStored(): boolean;
        setTracking(value: boolean): void;
        setStoring(value: boolean): void;
        setCount(value: boolean): void;
        setAlias(value: string): void;
        getAlias(): string | undefined;
        stat: {
            unsupported(): string[];
            error(): string[];
            counter(): { [key: string]: number };
            order(): IOrderStat[];
            operations(): { [key: string]: number };
        };
        emit: {
            unsupported(msg: string): void;
            error(msg: string): void;
            event(event: string, id?: string): void;
            operation(operation: string, id?: string): void;
        };
    } {
        const self = this;
        return {
            getEvents() {
                return {
                    unsupported: self.tracking.subjects.unsupported,
                    error: self.tracking.subjects.error,
                };
            },
            isTracking(): boolean {
                return self.tracking.track;
            },
            isStored(): boolean {
                return self.tracking.store;
            },
            setTracking(value: boolean): void {
                self.tracking.track = value;
            },
            setStoring(value: boolean): void {
                self.tracking.store = value;
            },
            setCount(value: boolean): void {
                self.tracking.count = value;
            },
            setAlias(value: string): void {
                self.tracking.stat.alias = value;
            },
            getAlias(): string | undefined {
                return self.tracking.stat.alias;
            },
            stat: {
                unsupported(): string[] {
                    return self.tracking.stat.unsupported;
                },
                error(): string[] {
                    return self.tracking.stat.error;
                },
                counter(): { [key: string]: number } {
                    return self.tracking.stat.counter;
                },
                order(): IOrderStat[] {
                    return self.tracking.stat.order;
                },
                operations(): { [key: string]: number } {
                    return self.tracking.stat.operations;
                },
            },
            emit: {
                unsupported(msg: string): void {
                    if (self.tracking.track) {
                        self.tracking.subjects.unsupported.emit(msg);
                    }
                    if (self.tracking.store) {
                        self.tracking.stat.unsupported.push(msg);
                    }
                },
                error(msg: string): void {
                    if (self.tracking.track) {
                        self.tracking.subjects.error.emit(msg);
                    }
                    if (self.tracking.store) {
                        self.tracking.stat.error.push(msg);
                    }
                },
                event(event: string, id?: string): void {
                    if (!self.tracking.count) {
                        return;
                    }
                    if (self.tracking.stat.counter[event] === undefined) {
                        self.tracking.stat.counter[event] = 0;
                    }
                    self.tracking.stat.counter[event] += 1;
                    const operation =
                        id === undefined
                            ? undefined
                            : self.tracking.stat.order.find((s) => s.id === id);
                    if (operation === undefined) {
                        self.tracking.stat.order.push({
                            type: 'E',
                            name: event,
                            id,
                            emitted: -1,
                            duration: -1,
                        });
                    } else {
                        const emitted = Date.now();
                        self.tracking.stat.order.push({
                            type: 'E',
                            name: event,
                            id,
                            emitted: emitted,
                            duration: -1,
                        });
                        operation.duration = emitted - operation.emitted;
                    }
                },
                operation(operation: string, id?: string): void {
                    if (!self.tracking.count) {
                        return;
                    }
                    if (self.tracking.stat.operations[operation] === undefined) {
                        self.tracking.stat.operations[operation] = 0;
                    }
                    self.tracking.stat.operations[operation] += 1;
                    self.tracking.stat.order.push({
                        type: 'O',
                        name: operation,
                        id,
                        emitted: Date.now(),
                        duration: -1,
                    });
                },
            },
        };
    }

    /**
     * We are expecting to get from rust event data as JSON string. Required format is:
     * { [type: string]: string | undefined }
     * @param data {string}
     */
    private _emitter(buf: Uint8Array) {
        let event: any;
        try {
            event = this.decoder(buf);
        } catch (err) {
            this.debug().emit.error(
                this.logger.error(`Fail to decode CallbackEvent: ${error(err)}`),
            );
            return;
        }
        if (typeof event === 'string') {
            this._emit(event, null);
        } else if (typeof event !== 'object' || event === null || Object.keys(event).length !== 1) {
            this.debug().emit.error(
                this.logger.error(
                    `Has been gotten incorrect event data: ${JSON.stringify(
                        event,
                    )}. No any props field found.\nExpecting type: { [type: string]: string | undefined }`,
                ),
            );
        } else {
            const type: string = Object.keys(event)[0];
            const body: any = event[type];
            this._emit(type, body);
        }
    }

    private _destroy() {
        this._destroyed = true;
        // Unsubscribe all event listeners
        Object.keys(this.getEvents() as unknown as object).forEach((key: string) => {
            (this.getEvents() as any)[key].destroy();
        });
        Object.keys(this.tracking.subjects).forEach((key: string) => {
            (this.tracking.subjects as any)[key].destroy();
        });
        this.logger.debug(`Provider has been destroyed.`);
    }

    private _emit(event: string, data: any) {
        // Callback (_emitter(data: TEventData)) is executed in rust scope.
        // It means if we will have some JS exception it will make rust crash.
        // To prevent it, we have to move event forward in separeted "JS-thread".
        // That's why here used timer with 0 delay.
        // Using of try { } catch() {} here isn't good idea as soon as it would not
        // allow to localize an issue
        setTimeout(() => {
            if ((this.getEventsSignatures() as any)[event] === undefined) {
                const msg: string = `Has been gotten unsupported event: "${event}".`;
                this.debug().emit.unsupported(msg);
                this.logger.error(msg);
                this.debug().emit.event(event);
            } else {
                if (event === 'OperationDone' && typeof data.uuid === 'string') {
                    this.debug().emit.event(event, data.uuid);
                } else {
                    this.debug().emit.event(event);
                }
                const err: Error | undefined = validateEventDesc(
                    (this.getEventsInterfaces() as any)[event],
                    data,
                );

                if (err instanceof Error) {
                    this.debug().emit.error(`Error: ${error(err)}. Input: ${JSON.stringify(data)}`);
                    this.logger.error(`Failed to parse event "${event}" due error: ${error(err)}`);
                } else {
                    const converted = data === null ? data : this.getConvertor(event, data);
                    if (converted instanceof Error) {
                        this.logger.error(
                            `Failed to convert results fro event "${event}" due error: ${error(
                                converted,
                            )}`,
                        );
                    }
                    (this.getEvents() as any)[event].emit(converted);
                    this.logger.verbose(`Event "${event}" is processed`);
                }
            }
        }, 0);
    }

    public getEmitter(): TEventEmitter {
        return this._emitter;
    }
}

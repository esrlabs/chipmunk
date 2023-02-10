/// 1. All RUST public methods should have operation ID
/// 2. In Summary (test) we should highlight link between operation caller and operation done event;
///    we should show IDs
/// 3. Add performance test (grabbing)

import { Subject } from 'platform/env/subscription';
import { error } from 'platform/env/logger';

import * as Logs from '../util/logging';

import { TEventData, TEventEmitter, IEventData } from '../provider/provider.general';

export interface IOrderStat {
    type: 'E' | 'O';
    name: string;
    id: string | undefined;
    emitted: number; // Time of emitting event or operation
    duration: number;
}
export abstract class Computation<TEvents, IEventsSignatures, IEventsInterfaces> {
    private _destroyed: boolean = false;
    private readonly _uuid: string;
    private readonly _tracking: {
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
    public readonly logger: Logs.Logger;

    constructor(uuid: string) {
        this._uuid = uuid;
        this._emitter = this._emitter.bind(this);
        this.logger = Logs.getLogger(`${this.getName()}: ${uuid}`);
    }

    public destroy(): Promise<void> {
        if (this._destroyed) {
            this.logger.warn(`Computation (${this._uuid}) is already destroying or destroyed`);
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
                    unsupported: self._tracking.subjects.unsupported,
                    error: self._tracking.subjects.error,
                };
            },
            isTracking(): boolean {
                return self._tracking.track;
            },
            isStored(): boolean {
                return self._tracking.store;
            },
            setTracking(value: boolean): void {
                self._tracking.track = value;
            },
            setStoring(value: boolean): void {
                self._tracking.store = value;
            },
            setCount(value: boolean): void {
                self._tracking.count = value;
            },
            setAlias(value: string): void {
                self._tracking.stat.alias = value;
            },
            getAlias(): string | undefined {
                return self._tracking.stat.alias;
            },
            stat: {
                unsupported(): string[] {
                    return self._tracking.stat.unsupported;
                },
                error(): string[] {
                    return self._tracking.stat.error;
                },
                counter(): { [key: string]: number } {
                    return self._tracking.stat.counter;
                },
                order(): IOrderStat[] {
                    return self._tracking.stat.order;
                },
                operations(): { [key: string]: number } {
                    return self._tracking.stat.operations;
                },
            },
            emit: {
                unsupported(msg: string): void {
                    if (self._tracking.track) {
                        self._tracking.subjects.unsupported.emit(msg);
                    }
                    if (self._tracking.store) {
                        self._tracking.stat.unsupported.push(msg);
                    }
                },
                error(msg: string): void {
                    if (self._tracking.track) {
                        self._tracking.subjects.error.emit(msg);
                    }
                    if (self._tracking.store) {
                        self._tracking.stat.error.push(msg);
                    }
                },
                event(event: string, id?: string): void {
                    if (!self._tracking.count) {
                        return;
                    }
                    if (self._tracking.stat.counter[event] === undefined) {
                        self._tracking.stat.counter[event] = 0;
                    }
                    self._tracking.stat.counter[event] += 1;
                    const operation =
                        id === undefined
                            ? undefined
                            : self._tracking.stat.order.find((s) => s.id === id);
                    if (operation === undefined) {
                        self._tracking.stat.order.push({
                            type: 'E',
                            name: event,
                            id,
                            emitted: -1,
                            duration: -1,
                        });
                    } else {
                        const emitted = Date.now();
                        self._tracking.stat.order.push({
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
                    if (!self._tracking.count) {
                        return;
                    }
                    if (self._tracking.stat.operations[operation] === undefined) {
                        self._tracking.stat.operations[operation] = 0;
                    }
                    self._tracking.stat.operations[operation] += 1;
                    self._tracking.stat.order.push({
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
    private _emitter(data: TEventData) {
        function dataAsStr(data: TEventData): { debug: string; verb?: string } {
            let message = '';
            if (typeof data === 'string') {
                message = `(defined as string): ${data}`;
            } else {
                message = `(defined as object): keys: ${Object.keys(data).join(
                    ', ',
                )} / values: ${Object.keys(data)
                    .map((k) => JSON.stringify(data[k]))
                    .join(', ')}`;
            }
            return {
                debug: `${message.substring(0, 250)}${message.length > 250 ? '...' : ''}`,
                verb: message.length > 250 ? message : undefined,
            };
        }
        const logs = dataAsStr(data);
        this.logger.debug(`Event from rust:\n\t${logs.debug}`);
        logs.verb !== undefined && this.logger.verbose(`Event from rust:\n\t${logs.verb}`);
        let event: Required<IEventData>;
        if (typeof data === 'string') {
            try {
                event = JSON.parse(data);
            } catch (e) {
                const msg: string = `Failed to parse rust event data due error: ${e}.\nExpecting type (JSON string): { [type: string]: string | undefined }, got: ${data}`;
                this.debug().emit.error(msg);
                this.logger.error(msg);
                return;
            }
        } else if (typeof data === 'object' && data !== null) {
            event = data;
        } else {
            const msg: string = `Unsupported format of event data: ${typeof data} / ${data}.\nExpecting type (JSON string): { [type: string]: string | undefined }`;
            this.debug().emit.error(msg);
            this.logger.error(msg);
            return;
        }
        if (typeof event === 'string') {
            this._emit(event, null);
        } else if (typeof event !== 'object' || event === null || Object.keys(event).length !== 1) {
            const msg: string = `Has been gotten incorrect event data: ${data}. No any props field found.\nExpecting type (JSON string): { [type: string]: string | undefined }`;
            this.debug().emit.error(msg);
            this.logger.error(msg);
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
        Object.keys(this._tracking.subjects).forEach((key: string) => {
            (this._tracking.subjects as any)[key].destroy();
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
                const err: Error | undefined = Subject.validate(
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
                    this.logger.debug(`Event "${event}" is processed`);
                }
            }
        }, 0);
    }

    public getEmitter(): TEventEmitter {
        return this._emitter;
    }
}

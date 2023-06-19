import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { ObserveOperation } from './operation';
import { error } from '@platform/log/utils';
import { SdeRequest, SdeResponse } from '@platform/types/sde';
import { Subject, Subjects } from '@platform/env/subscription';

import * as Requests from '@platform/ipc/request';

@SetupLogger()
export class Sde {
    public readonly subjects: Subjects<{
        updated: Subject<void>;
        visibility: Subject<void>;
        selected: Subject<string | undefined>;
    }> = new Subjects({
        updated: new Subject<void>(),
        visibility: new Subject<void>(),
        selected: new Subject<string | undefined>(),
    });
    protected readonly uuid: string;
    protected operations: ObserveOperation[] = [];
    protected selected: ObserveOperation | undefined;
    protected hidden: boolean = false;

    constructor(uuid: string) {
        this.uuid = uuid;
    }

    public destroy() {
        this.subjects.destroy();
    }

    public send(uuid: string, request: SdeRequest): Promise<SdeResponse> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Observe.SDE.Response,
                new Requests.Observe.SDE.Request({
                    session: this.uuid,
                    operation: uuid,
                    request,
                }),
            )
                .then((response: Requests.Observe.SDE.Response) => {
                    if (response.error !== undefined) {
                        return reject(new Error(response.error));
                    }
                    if (response.result === undefined) {
                        return reject(new Error(`SDE doesn't return any kind of result`));
                    }
                    try {
                        resolve(response.result);
                    } catch (e) {
                        return reject(new Error(error(e)));
                    }
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to send SDE into operation: ${error.message}`);
                });
        });
    }

    public overwrite(running: Map<string, ObserveOperation>): void {
        this.operations = Array.from(running.values()).filter((s) => s.asOrigin().isSdeSupported());
        this.subjects.get().updated.emit();
        if (this.selected !== undefined) {
            const target = this.selected.uuid;
            if (this.operations.find((o) => o.uuid === target) === undefined) {
                this.selecting().first();
            }
        } else {
            this.selecting().first();
        }
    }

    public isAvailable(): boolean {
        return this.operations.length > 0;
    }

    public get(): ObserveOperation[] {
        return this.operations;
    }

    public visibility(): {
        show(): void;
        hide(): void;
        hidden(): boolean;
    } {
        return {
            show: (): void => {
                this.hidden = false;
                this.subjects.get().visibility.emit();
            },
            hide: (): void => {
                this.hidden = true;
                this.subjects.get().visibility.emit();
            },
            hidden: (): boolean => {
                return this.hidden;
            },
        };
    }

    public selecting(): {
        is(uuid: string): boolean;
        first(): void;
        select(uuid: string | undefined): boolean;
        get(): ObserveOperation | undefined;
    } {
        return {
            is: (uuid: string): boolean => {
                return this.selected === undefined
                    ? false
                    : this.selected.uuid === uuid || this.selected.asObserve().uuid === uuid;
            },
            first: (): void => {
                if (this.operations.length === 0) {
                    this.selected = undefined;
                    this.subjects.get().selected.emit(undefined);
                    return;
                }
                if (this.selected !== undefined && this.selected.uuid === this.operations[0].uuid) {
                    return;
                }
                this.selected = this.operations[0];
                this.subjects.get().selected.emit(this.selected.uuid);
            },
            select: (uuid: string | undefined): boolean => {
                if (uuid === undefined) {
                    const changed = this.selected !== undefined;
                    this.selected = undefined;
                    changed && this.subjects.get().selected.emit(uuid);
                    return changed;
                }
                if (this.selected !== undefined && this.selected.uuid === uuid) {
                    return false;
                }
                const candidate = this.operations.find(
                    (o) => o.uuid === uuid || o.asObserve().uuid === uuid,
                );
                if (candidate === undefined) {
                    return false;
                }
                this.selected = candidate;
                if (this.selected === undefined) {
                    return false;
                } else {
                    this.subjects.get().selected.emit(uuid);
                    return true;
                }
            },
            get: (): ObserveOperation | undefined => {
                return this.selected;
            },
        };
    }
}
export interface Sde extends LoggerInterface {}

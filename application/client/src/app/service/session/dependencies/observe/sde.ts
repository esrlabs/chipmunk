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
    }> = new Subjects({
        updated: new Subject<void>(),
        visibility: new Subject<void>(),
    });
    protected readonly uuid: string;
    protected operations: ObserveOperation[] = [];
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
        this.operations = Array.from(running.values()).filter((s) => s.asSource().isSDEAvaliable());
        this.subjects.get().updated.emit();
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
}
export interface Sde extends LoggerInterface {}

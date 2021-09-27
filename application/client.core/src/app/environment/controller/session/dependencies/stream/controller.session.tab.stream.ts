import { IPC, Subscription as IPCSubscription } from '../../../../services/service.electron.ipc';
import { Observable, Subject, Subscription } from 'rxjs';
import {
    ControllerSessionTabStreamOutput,
    IStreamState,
} from '../output/controller.session.tab.stream.output';
import { ControllerSessionScope } from '../scope/controller.session.tab.scope';
import { ControllerSessionTabTimestamp } from '../timestamps/session.dependency.timestamps';
import { IQueueController } from '../../../../services/standalone/service.queue';
import { IRange } from '../../../helpers/selection';
import { IRow } from '../row/controller.row.api';
import { Dependency, SessionGetter } from '../session.dependency';

import QueueService from '../../../../services/standalone/service.queue';
import ServiceElectronIpc from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ControllerSessionTabStreamOutput, IStreamState };

export interface IControllerSessionStream {
    guid: string;
    scope: ControllerSessionScope;
    timestamp: ControllerSessionTabTimestamp;
}

export class ControllerSessionTabStream implements Dependency {
    private _logger: Toolkit.Logger;
    private _queue!: Toolkit.Queue;
    private _queueController: IQueueController | undefined;
    private _guid: string;
    private _subjects = {
        onSourceChanged: new Subject<number>(),
    };
    private _subscriptions: { [key: string]: Subscription | IPCSubscription } = {};
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        this._guid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStream: ${uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._queue = new Toolkit.Queue(this._logger.error.bind(this._logger), 0);
            // Subscribe to queue events
            this._queue_onDone = this._queue_onDone.bind(this);
            this._queue_onNext = this._queue_onNext.bind(this);
            this._queue.subscribe(Toolkit.Queue.Events.done, this._queue_onDone);
            this._queue.subscribe(Toolkit.Queue.Events.next, this._queue_onNext);
            // Subscribe to streams data
            this._subscriptions.onStreamUpdated = ServiceElectronIpc.subscribe(
                IPC.StreamUpdated,
                this._ipc_onStreamUpdated.bind(this),
            );
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            this._queue.unsubscribeAll();
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionTabStream';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        onSourceChanged: Observable<number>;
    } {
        return {
            onSourceChanged: this._session().getStreamOutput().getObservable().onSourceChanged,
        };
    }

    public getRowsSelection(ranges: IRange[]): Promise<IRow[]> {
        return new Promise((resolve, reject) => {
            if (ranges.length === 0) {
                return resolve([]);
            }
            let packets: IRow[] = [];
            Toolkit.sequences(
                ranges.map((range: IRange) => {
                    return () => {
                        if (range.start.search !== undefined && range.end.search !== undefined) {
                            return this._session()
                                .getSessionSearch()
                                .getOutputStream()
                                .loadRange({
                                    start: range.start.search,
                                    end: range.end.search,
                                })
                                .then((packet: IRow[]) => {
                                    packets = packets.concat(packet);
                                });
                        } else {
                            return this._session()
                                .getStreamOutput()
                                .loadRange({
                                    start: range.start.output,
                                    end: range.end.output,
                                })
                                .then((packet: IRow[]) => {
                                    packets = packets.concat(packet);
                                });
                        }
                    };
                }),
            )
                .then(() => {
                    resolve(packets);
                })
                .catch(reject);
        });
    }

    private _ipc_onStreamUpdated(message: IPC.StreamUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        this._session().getStreamOutput().updateStreamState(message);
    }

    private _queue_onNext(done: number, total: number) {
        if (this._queueController === undefined) {
            this._queueController = QueueService.create('reading');
        }
        this._queueController.next(done, total);
    }

    private _queue_onDone() {
        if (this._queueController === undefined) {
            return;
        }
        this._queueController.done();
        this._queueController = undefined;
    }
}

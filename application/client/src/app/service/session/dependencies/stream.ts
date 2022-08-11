import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Range } from '@platform/types/range';
import { cutUuid } from '@log/index';
import { Rank } from './rank';
import { IGrabbedElement } from '@platform/types/content';
import { DataSource } from '@platform/types/observe';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Stream extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<number>;
        observe: Subject<Map<string, DataSource>>;
        rank: Subject<number>;
    }> = new Subjects({
        updated: new Subject<number>(),
        observe: new Subject<Map<string, DataSource>>(),
        rank: new Subject<number>(),
    });
    private _len: number = 0;
    private _uuid!: string;

    public readonly observed: Map<string, DataSource> = new Map();
    public readonly rank: Rank = new Rank();

    public init(uuid: string) {
        this.setLoggerName(`Stream: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.register(
            Events.IpcEvent.subscribe(Events.Stream.Updated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.rows;
                this.subjects.get().updated.emit(this._len);
                if (this.rank.set(this._len.toString().length)) {
                    this.subjects.get().rank.emit(this.rank.len);
                }
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Observe.Started.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._updateObserved().catch((err: Error) => {
                    this.log().error(`Fail to update sources list: ${err.message}`);
                });
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Observe.Finished.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._updateObserved().catch((err: Error) => {
                    this.log().error(`Fail to update sources list: ${err.message}`);
                });
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public len(): number {
        return this._len;
    }

    public chunk(range: Range): Promise<IGrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Stream.Chunk.Response,
                new Requests.Stream.Chunk.Request({
                    session: this._uuid,
                    from: range.from,
                    to: range.to,
                }),
            )
                .then((response: Requests.Stream.Chunk.Response) => {
                    resolve(response.rows);
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to grab content: ${error.message}`);
                });
        });
    }

    private _updateObserved(): Promise<void> {
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Observe.List.Response,
                new Requests.Observe.List.Request({
                    session: this._uuid,
                }),
            )
                .then((response: Requests.Observe.List.Response) => {
                    const sources: Map<string, DataSource> = new Map();
                    Object.keys(response.sources).forEach((uuid: string) => {
                        const source = DataSource.from(response.sources[uuid]);
                        if (source instanceof Error) {
                            this.log().error(`Fail to parse DataSource: ${source.message}`);
                            return;
                        }
                        sources.set(uuid, source);
                    });
                    this.observed.clear();
                    sources.forEach((s, k) => this.observed.set(k, s));
                    this.subjects.get().observe.emit(this.observed);
                    resolve();
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to get a list of observed sources: ${error.message}`);
                });
        });
    }
}
export interface Stream extends LoggerInterface {}

import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { ISearchMap, INearest } from '@platform/types/filter';
import { cutUuid } from '@log/index';
import { IFilter, ISearchUpdated } from '@platform/types/filter';
import { IRange } from '@platform/types/range';
import { FilterRequest, FiltersStore } from './search/filters/store';
import { DisableStore } from './search/disabled/store';
import { ChartsStore } from './search/charts/store';
import { State } from './search/state';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Search extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<ISearchUpdated>;
        map: Subject<void>;
    }> = new Subjects({
        updated: new Subject<ISearchUpdated>(),
        map: new Subject<void>(),
    });
    private _len: number = 0;
    private _uuid!: string;
    private _store!: {
        filters: FiltersStore;
        charts: ChartsStore;
        disabled: DisableStore;
    };
    private _state!: State;

    public init(uuid: string) {
        this.setLoggerName(`Search: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.register(
            Events.IpcEvent.subscribe(Events.Search.Updated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.rows;
                this.subjects.get().updated.emit({ found: this._len, stat: event.stat });
            }),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Search.MapUpdated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this.subjects.get().map.emit();
            }),
        );
        this._store = {
            filters: new FiltersStore(uuid),
            charts: new ChartsStore(uuid),
            disabled: new DisableStore(uuid),
        };
        this.register(
            this._store.filters.subjects.get().value.subscribe(() => {
                this.state()
                    .filters()
                    .catch((err: Error) => {
                        this.log().error(`Fail to trigger search by filters: ${err.message}`);
                    });
            }),
        );
        this.register(
            this._store.charts.subjects.get().value.subscribe(() => {
                this.state()
                    .charts()
                    .catch((err: Error) => {
                        this.log().error(`Fail to trigger search by charts: ${err.message}`);
                    });
            }),
        );
        this._state = new State(this);
    }

    public destroy() {
        this.unsubscribe();
        this._store.filters.destroy();
        this._store.charts.destroy();
        this._store.disabled.destroy();
        this._state.destroy();
        this.subjects.destroy();
    }

    public len(): number {
        return this._len;
    }

    public search(filters: IFilter[]): Promise<number> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Search.Search.Response,
                new Requests.Search.Search.Request({
                    session: this._uuid,
                    filters: filters.filter((f) => FilterRequest.isValid(f)),
                }),
            )
                .then((response) => {
                    if (typeof response.error === 'string' && response.error.trim() !== '') {
                        reject(new Error(response.error));
                    } else {
                        resolve(response.canceled ? 0 : response.found);
                    }
                })
                .catch(reject);
        });
    }

    public extract(filters: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Values.Extract.Response,
                new Requests.Values.Extract.Request({
                    session: this._uuid,
                    filters,
                }),
            )
                .then((response) => {
                    if (typeof response.error === 'string' && response.error.trim() !== '') {
                        reject(new Error(response.error));
                    } else {
                        resolve();
                    }
                })
                .catch(reject);
        });
    }

    public getScaledMap(len: number, range?: IRange): Promise<ISearchMap> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Search.Map.Response,
                new Requests.Search.Map.Request({
                    session: this._uuid,
                    len,
                    from: range ? range.from : undefined,
                    to: range ? range.to : undefined,
                }),
            )
                .then((response) => {
                    resolve(response.map);
                })
                .catch(reject);
        });
    }

    public drop(): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Search.Drop.Response,
                new Requests.Search.Drop.Request({
                    session: this._uuid,
                }),
            )
                .then(() => {
                    resolve(undefined);
                })
                .catch(reject);
        });
    }

    public nearest(stream: number): Promise<INearest | undefined> {
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Search.Nearest.Response,
                new Requests.Search.Nearest.Request({
                    session: this._uuid,
                    row: stream,
                }),
            )
                .then((response: Requests.Search.Nearest.Response) => {
                    resolve(response.nearest);
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to get nearest content: ${error.message}`);
                });
        });
    }

    public store(): {
        filters(): FiltersStore;
        charts(): ChartsStore;
        disabled(): DisableStore;
    } {
        return {
            filters: (): FiltersStore => {
                return this._store.filters;
            },
            charts: (): ChartsStore => {
                return this._store.charts;
            },
            disabled: (): DisableStore => {
                return this._store.disabled;
            },
        };
    }

    public state(): State {
        return this._state;
    }
}
export interface Search extends LoggerInterface {}

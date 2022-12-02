import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { ISearchUpdated } from '@platform/types/filter';
import { ISearchMap } from '@platform/interfaces/interface.rust.api.general';
import { cutUuid } from '@log/index';
import { IFilter } from '@platform/types/filter';
import { FiltersStore } from './search/filters/store';
import { DisableStore } from './search/disabled/store';
import { Highlights } from './search/highlights';
import { State } from './search/state';
import { Map } from './search/map';
import { Bookmarks } from './bookmarks';
import { Cursor } from './cursor';
import { Stream } from './stream';
import { IRange } from '@platform/types/range';

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
    public readonly map: Map = new Map();
    private _len: number = 0;
    private _uuid!: string;
    private _store!: {
        filters: FiltersStore;
        disabled: DisableStore;
    };
    private _highlights!: Highlights;
    private _state!: State;

    public init(uuid: string, stream: Stream, bookmarks: Bookmarks, cursor: Cursor) {
        this.setLoggerName(`Search: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.map.init(stream, bookmarks, cursor);
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
                const error = this.map.parse(event.map);
                if (error instanceof Error) {
                    this.log().error(`Fail to parse map update: ${error.message}`);
                } else {
                    this.subjects.get().map.emit();
                }
            }),
        );
        this._store = {
            filters: new FiltersStore(uuid),
            disabled: new DisableStore(uuid),
        };
        this._state = new State(this);
        this._highlights = new Highlights(this);
    }

    public destroy() {
        this.unsubscribe();
        this._store.filters.destroy();
        this._store.disabled.destroy();
        this._highlights.destroy();
        this._state.destroy();
        this.map.destroy();
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
                    filters,
                }),
            )
                .then((response) => {
                    if (response.found !== undefined) {
                        resolve(response.found);
                    } else {
                        reject(
                            response.canceled
                                ? new Error(`Operation is canceled`)
                                : new Error(`No results of search`),
                        );
                    }
                })
                .catch(reject);
        });
    }

    public getScaledMap(len: number): Promise<ISearchMap> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Search.Map.Response,
                new Requests.Search.Map.Request({
                    session: this._uuid,
                    len,
                    from: undefined,
                    to: undefined,
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

    public nearest(stream: number): Promise<{ stream: number; position: number }> {
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Search.Nearest.Response,
                new Requests.Search.Nearest.Request({
                    session: this._uuid,
                    row: stream,
                }),
            )
                .then((response: Requests.Search.Nearest.Response) => {
                    resolve({ stream: response.stream, position: response.position });
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to get nearest content: ${error.message}`);
                });
        });
    }

    public store(): {
        filters(): FiltersStore;
        disabled(): DisableStore;
    } {
        return {
            filters: (): FiltersStore => {
                return this._store.filters;
            },
            disabled: (): DisableStore => {
                return this._store.disabled;
            },
        };
    }

    public state(): State {
        return this._state;
    }

    public highlights(): Highlights {
        return this._highlights;
    }

    public export(): {
        text(dest: string, ranges: IRange[]): Promise<boolean>;
        raw(dest: string, ranges: IRange[]): Promise<boolean>;
        isRawAvailable(): Promise<boolean>;
    } {
        return {
            text: (dest: string, ranges: IRange[]): Promise<boolean> => {
                if (this._len === 0) {
                    return Promise.resolve(true);
                }
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Search.Export.Response,
                        new Requests.Search.Export.Request({
                            session: this._uuid,
                            dest,
                            ranges,
                        }),
                    )
                        .then((response: Requests.Search.Export.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.complete);
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to export content: ${error.message}`);
                        });
                });
            },
            raw: (dest: string, ranges: IRange[]): Promise<boolean> => {
                if (this._len === 0) {
                    return Promise.resolve(true);
                }
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Search.ExportRaw.Response,
                        new Requests.Search.ExportRaw.Request({
                            session: this._uuid,
                            dest,
                            ranges,
                        }),
                    )
                        .then((response: Requests.Search.ExportRaw.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.complete);
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to export raw: ${error.message}`);
                        });
                });
            },
            isRawAvailable: (): Promise<boolean> => {
                if (this._len === 0) {
                    return Promise.resolve(false);
                }
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Session.IsExportRawAvailable.Response,
                        new Requests.Session.IsExportRawAvailable.Request({
                            session: this._uuid,
                        }),
                    )
                        .then((response: Requests.Session.IsExportRawAvailable.Response) => {
                            if (response.error !== undefined) {
                                return reject(new Error(response.error));
                            }
                            resolve(response.available);
                        })
                        .catch((error: Error) => {
                            this.log().error(`Fail to check state export raw: ${error.message}`);
                        });
                });
            },
        };
    }
}
export interface Search extends LoggerInterface {}

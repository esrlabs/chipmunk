import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subject } from '@platform/env/subscription';
import { Range } from '@platform/types/range';
import { ilc, Emitter, Channel, Declarations, Services } from '@service/ilc';
import { cutUuid } from '@log/index';
import { IFilter, ISearchResults } from '@platform/types/filter';
import { IGrabbedElement } from '@platform/types/content';
import { FiltersStore } from './search/filters/store';
import { DisableStore } from './search/disabled/store';
import { Highlights } from './search/highlights';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Search {
    private readonly _subscriber: Subscriber = new Subscriber();
    private _len: number = 0;
    private _uuid!: string;
    private _emitter!: Emitter;
    private _store!: {
        filters: FiltersStore;
        disabled: DisableStore;
    };
    private _highlights!: Highlights;

    public init(uuid: string) {
        this.setLoggerName(`Search: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._emitter = ilc.emitter(this.getLoggerName(), this.log());
        this._subscriber.register(
            Events.IpcEvent.subscribe(Events.Search.Updated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.rows;
                this._emitter.session.search.updated({
                    session: this._uuid,
                    len: this._len,
                });
            }),
        );
        this._store = {
            filters: new FiltersStore(uuid),
            disabled: new DisableStore(uuid),
        };
        this._highlights = new Highlights(this._store.filters);
    }

    public destroy() {
        this._subscriber.unsubscribe();
        this._store.filters.destroy();
        this._store.disabled.destroy();
        this._highlights.destroy();
    }

    public len(): number {
        return this._len;
    }

    public search(filters: IFilter[]): Promise<ISearchResults> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Search.Search.Response,
                new Requests.Search.Search.Request({
                    session: this._uuid,
                    filters,
                }),
            )
                .then((response) => {
                    if (response.results !== undefined) {
                        resolve(response.results);
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

    public drop(): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Search.Drop.Response,
                new Requests.Search.Drop.Request({
                    session: this._uuid,
                }),
            )
                .then((_response) => {
                    resolve(undefined);
                })
                .catch(reject);
        });
    }

    public chunk(range: Range): Promise<IGrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Search.Chunk.Response,
                new Requests.Search.Chunk.Request({
                    session: this._uuid,
                    from: range.from,
                    to: range.to,
                }),
            )
                .then((response: Requests.Search.Chunk.Response) => {
                    resolve(response.rows);
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to grab content: ${error.message}`);
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

    public highlights(): Highlights {
        return this._highlights;
    }
}
export interface Search extends LoggerInterface {}

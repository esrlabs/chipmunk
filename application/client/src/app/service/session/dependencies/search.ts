import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Range } from '@platform/types/range';
import { cutUuid } from '@log/index';
import { IFilter, ISearchResults } from '@platform/types/filter';
import { IGrabbedElement } from '@platform/types/content';
import { FiltersStore } from './search/filters/store';
import { DisableStore } from './search/disabled/store';
import { Highlights } from './search/highlights';
import { State } from './search/state';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Search extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<number>;
    }> = new Subjects({
        updated: new Subject<number>(),
    });
    private _len: number = 0;
    private _uuid!: string;
    private _store!: {
        filters: FiltersStore;
        disabled: DisableStore;
    };
    private _highlights!: Highlights;
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
                this.subjects.get().updated.emit(this._len);
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
        this.subjects.destroy();
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
                .then(() => {
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

    public state(): State {
        return this._state;
    }

    public highlights(): Highlights {
        return this._highlights;
    }
}
export interface Search extends LoggerInterface {}

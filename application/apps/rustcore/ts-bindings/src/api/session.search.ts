import * as Logs from '../util/logging';

import { RustSession } from '../native/native.session';
import { ICancelablePromise, CancelablePromise } from 'platform/env/promise';
import { EventProvider } from '../api/session.provider';
import {
    IFilter,
    IGrabbedElement,
    ISearchMap,
    TExtractedValues,
    INearest,
} from '../interfaces/index';
import { Executors } from './executors/session.stream.executors';
import { SearchValuesResult } from 'platform/types/filter';

export class SessionSearch {
    private readonly _provider: EventProvider;
    private readonly _session: RustSession;
    private readonly _uuid: string;
    private readonly _logger: Logs.Logger;
    private readonly _tasks: {
        search: {
            current: ICancelablePromise<number> | undefined;
            pending: { filters: IFilter[]; self: ICancelablePromise<number> } | undefined;
        };
        values: {
            current: ICancelablePromise<SearchValuesResult> | undefined;
            pending:
                | { filters: string[]; self: ICancelablePromise<SearchValuesResult> }
                | undefined;
        };
    } = {
        search: {
            current: undefined,
            pending: undefined,
        },
        values: {
            current: undefined,
            pending: undefined,
        },
    };

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        this._logger = Logs.getLogger(`SessionSearch: ${uuid}`);
        this._provider = provider;
        this._session = session;
        this._uuid = uuid;
    }

    public destroy(): Promise<void> {
        return Promise.resolve(undefined);
        // Provider would be destroyed on parent level (Session)
        // return new Promise((resolve, reject) => {
        //     this._provider
        //         .destroy()
        //         .then(resolve)
        //         .catch((err: Error) => {
        //             this._logger.error(`Fail to destroy provider due error: ${err instanceof Error ? err.message : err}`);
        //             reject(err);
        //         });
        // });
    }

    /**
     * Retruns a chunk of search results, which were gotten with filters by @method setFilters
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grab(start: number, len: number): Promise<IGrabbedElement[]> {
        return this._session.grabSearchChunk(start, len);
    }

    /**
     * Retruns a chunk of matches results, which were gotten with filters by @method setMatches
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grabMatchesChunk(start: number, len: number): string[] | Error {
        return this._session.grabMatchesChunk(start, len);
    }

    /**
     * Method sets filters for current session. These filters should be applyed for any
     * session changes. If new data came into session - filters should be applyed.
     * @cancelable no
     * @param filters { IFilter[] }
     */
    public setFilters(filters: IFilter[]): Error | undefined {
        const error: Error | string = this._session.setFilters(filters);
        if (error instanceof Error) {
            return error;
        }
        return undefined;
    }

    /**
     * Method sets filters for current session to detect list of matches. These filters should
     * be applyed for any session changes to update matches list. These filters aren't related
     * to regular search. It should not generate any search result file.
     * @cancelable no
     * @param filters { IFilter[] }
     */
    public setMatches(filters: IFilter[]): Error | undefined {
        const error: Error | undefined = this._session.setMatches(filters);
        if (error instanceof Error) {
            return error;
        }
        return undefined;
    }

    public search(filters: IFilter[]): ICancelablePromise<number> {
        const executor = (self: ICancelablePromise<number>, filters: IFilter[]) => {
            this._tasks.search.current = Executors.search(
                this._session,
                this._provider,
                this._logger,
                filters,
            )
                .finally(() => {
                    this._tasks.search.current = undefined;
                    const pending = this._tasks.search.pending;
                    this._tasks.search.pending = undefined;
                    if (pending !== undefined) {
                        executor(pending.self, pending.filters);
                    }
                })
                .bind(self);
            self.uuid(this._tasks.search.current.uuid());
        };
        // TODO: field "filters" of IResultSearchElement cannot be empty, at least 1 filter
        // should be present there always. This is a right place for check of it
        return new CancelablePromise((_resolve, _reject, _cancel, _refCancel, self) => {
            if (this._tasks.search.current === undefined) {
                executor(self, filters);
            } else {
                if (this._tasks.search.pending !== undefined) {
                    this._tasks.search.pending.self.abort();
                }
                this._tasks.search.pending = {
                    self,
                    filters,
                };
                this._tasks.search.current.abort();
            }
        });
    }

    public values(filters: string[]): ICancelablePromise<SearchValuesResult> {
        const executor = (self: ICancelablePromise<SearchValuesResult>, filters: string[]) => {
            this._tasks.values.current = Executors.values(
                this._session,
                this._provider,
                this._logger,
                filters,
            )
                .finally(() => {
                    this._tasks.values.current = undefined;
                    const pending = this._tasks.values.pending;
                    this._tasks.values.pending = undefined;
                    if (pending !== undefined) {
                        executor(pending.self, pending.filters);
                    }
                })
                .bind(self);
            self.uuid(this._tasks.values.current.uuid());
        };
        // TODO: field "filters" of IResultSearchElement cannot be empty, at least 1 filter
        // should be present there always. This is a right place for check of it
        return new CancelablePromise((_resolve, _reject, _cancel, _refCancel, self) => {
            if (this._tasks.values.current === undefined) {
                executor(self, filters);
            } else {
                if (this._tasks.values.pending !== undefined) {
                    this._tasks.values.pending.self.abort();
                }
                this._tasks.values.pending = {
                    self,
                    filters,
                };
                this._tasks.values.current.abort();
            }
        });
    }

    public drop(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this._tasks.search.pending !== undefined) {
                this._tasks.search.pending.self.abort();
            }
            this._tasks.search.pending = undefined;
            if (this._tasks.search.current === undefined) {
                this._session.dropSearch().then(resolve).catch(reject);
            } else {
                this._tasks.search.current
                    .finally(() => {
                        this._session.dropSearch().then(resolve).catch(reject);
                    })
                    .abort();
            }
        });
    }

    public extract(filters: IFilter[]): ICancelablePromise<TExtractedValues> {
        // TODO: field "filters" of IResultSearchElement cannot be empty, at least 1 filter
        // should be present there always. This is a right place for check of it
        return Executors.extract(this._session, this._provider, this._logger, filters);
    }

    public getMap(
        datasetLength: number,
        from?: number,
        to?: number,
    ): ICancelablePromise<ISearchMap> {
        return Executors.map(this._session, this._provider, this._logger, {
            datasetLength,
            from,
            to,
        });
    }

    public getNearest(positionInStream: number): ICancelablePromise<INearest | undefined> {
        return Executors.nearest(this._session, this._provider, this._logger, {
            positionInStream,
        });
    }

    public len(): Promise<number> {
        return this._session.getSearchLen();
    }
}

import * as Logs from '../util/logging';

import { RustSession } from '../native/index';
import { CancelablePromise } from '../util/promise';
import { EventProvider } from './session.provider';
import {
    IFilter,
    IGrabbedElement,
    ISearchResults,
    ISearchMap,
    TExtractedValues,
} from '../interfaces/index';
import { Executors } from './session.stream.executors';
import { NativeError } from '../interfaces/errors';

export class SessionSearch {
    private readonly _provider: EventProvider;
    private readonly _session: RustSession;
    private readonly _uuid: string;
    private readonly _logger: Logs.Logger;

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
        //             this._logger.error(`Fail to destroy provider due error: ${err.message}`);
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

    public search(filters: IFilter[]): CancelablePromise<ISearchResults> {
        // TODO: field "filters" of IResultSearchElement cannot be empty, at least 1 filter
        // should be present there always. This is a right place for check of it
        return Executors.search(this._session, this._provider, this._logger, filters);
    }

    public extract(filters: IFilter[]): CancelablePromise<TExtractedValues> {
        // TODO: field "filters" of IResultSearchElement cannot be empty, at least 1 filter
        // should be present there always. This is a right place for check of it
        return Executors.extract(this._session, this._provider, this._logger, filters);
    }

    public getMap(
        datasetLength: number,
        from?: number,
        to?: number,
    ): CancelablePromise<ISearchMap> {
        return Executors.map(this._session, this._provider, this._logger, {
            datasetLength,
            from,
            to,
        });
    }

    public getNearest(
        positionInStream: number,
    ): Promise<{ index: number; position: number } | undefined> {
        return this._session.getNearestTo(positionInStream);
    }

    public len(): Promise<number> {
        return this._session.getSearchLen();
    }
}

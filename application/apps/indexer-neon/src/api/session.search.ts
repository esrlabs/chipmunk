import * as Logs from '../util/logging';

import { RustSession } from '../native/index';
import { CancelablePromise } from '../util/promise';
import { EventProvider } from './session.provider';
import { IFilter, IMatchEntity } from '../interfaces/index';
import { IGeneralError } from '../interfaces/errors';
import { Executors } from './session.stream.executors';

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
        return new Promise((resolve, reject) => {
            this._provider
                .destroy()
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(`Fail to destroy provider due error: ${err.message}`);
                    reject(err);
                });
        });
    }

    /**
     * Retruns a chunk of search results, which were gotten with filters by @method setFilters
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grabSearchChunk(start: number, len: number): string[] | IGeneralError {
        return this._session.grabSearchChunk(start, len);
    }

    /**
     * Retruns a chunk of matches results, which were gotten with filters by @method setMatches
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grabMatchesChunk(start: number, len: number): string[] | IGeneralError {
        return this._session.grabMatchesChunk(start, len);
    }

    /**
     * Method sets filters for current session. These filters should be applyed for any
     * session changes. If new data came into session - filters should be applyed.
     * @cancelable no
     * @param filters { IFilter[] }
     */
    public setFilters(filters: IFilter[]): Error | undefined {
        const error: IGeneralError | undefined = this._session.setFilters(filters);
        if (error !== undefined) {
            this._logger.warn(`Fail to set filters for search due error: ${error.message}`);
            return new Error(error.message);
        } else {
            return undefined;
        }
    }

    /**
     * Method sets filters for current session to detect list of matches. These filters should
     * be applyed for any session changes to update matches list. These filters aren't related
     * to regular search. It should not generate any search result file.
     * @cancelable no
     * @param filters { IFilter[] }
     */
    public setMatches(filters: IFilter[]): Error | undefined {
        const error: IGeneralError | undefined = this._session.setMatches(filters);
        if (error !== undefined) {
            this._logger.warn(`Fail to set filters for matches due error: ${error.message}`);
            return new Error(error.message);
        } else {
            return undefined;
        }
    }

    public search(filters: IFilter[]): CancelablePromise<IMatchEntity[]> {
        return Executors.search(this._session, this._provider, this._logger, filters);
    }

    public len(): number {
        const len = this._session.getStreamLen();
        if (typeof len !== 'number' || isNaN(len) || !isFinite(len)) {
            this._logger.warn(
                `Has been gotten not valid rows number: ${len} (typeof: ${typeof len}).`,
            );
            return 0;
        } else {
            return len;
        }
    }
}

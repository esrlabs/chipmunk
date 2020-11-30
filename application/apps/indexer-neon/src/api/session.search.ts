import * as Logs from '../util/logging';

import {
    RustSessionChannel,
} from '../native/index';
import { CancelablePromise } from '../util/promise';
import { Subscription } from '../util/events.subscription';
import { SessionComputation } from './session.computation';
import { IFilter, IMatchEntity } from '../interfaces/index';
import { StreamSearchComputation } from './session.stream.search.computation';
import { IGeneralError, EErrorSeverity } from '../interfaces/errors';
import { TCanceler } from '../native/native';

export class SessionSearch {
    private readonly _computation: SessionComputation;
    private readonly _channel: RustSessionChannel;
    private readonly _uuid: string;
    private readonly _logger: Logs.Logger;

    constructor(computation: SessionComputation, channel: RustSessionChannel, uuid: string) {
        this._logger = Logs.getLogger(`SessionSearch: ${uuid}`);
        this._computation = computation;
        this._channel = channel;
        this._uuid = uuid;
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._computation
                .destroy()
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(`Fail to destroy computation due error: ${err.message}`);
                    reject(err);
                });
        });
    }

    /**
     * Retruns a chunk of search results, which were gotten with filters by @method setFilters
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grabSearchChunk(start: number, len: number): string | IGeneralError {
        return this._channel.grabSearchChunk(start, len);
    }

    /**
     * Retruns a chunk of matches results, which were gotten with filters by @method setMatches
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grabMatchesChunk(start: number, len: number): string | IGeneralError  {
        return this._channel.grabMatchesChunk(start, len);
    }

    /**
     * Method sets filters for current session. These filters should be applyed for any
     * session changes. If new data came into session - filters should be applyed.
     * @cancelable no
     * @param filters { IFilter[] }
     */
    public setFilters(filters: IFilter[]): Error | undefined {
        const error: IGeneralError  | undefined = this._channel.setSearch(filters);
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
        const error: IGeneralError | undefined = this._channel.setMatches(filters);
        if (error !== undefined) {
            this._logger.warn(`Fail to set filters for matches due error: ${error.message}`);
            return new Error(error.message);
        } else {
            return undefined;
        }
    }

    public search(filters: IFilter[]): CancelablePromise<IMatchEntity[]> {
        return new CancelablePromise<IMatchEntity[]>(
            (resolve, reject, cancel, refCancelCB, self) => {
                const computation: StreamSearchComputation = new StreamSearchComputation(
                    this._uuid,
                );
                let error: Error | undefined;
                // Setup subscriptions
                const subscriptions: {
                    destroy: Subscription;
                    matches: Subscription;
                    error: Subscription;
                    unsunscribe(): void;
                } = {
                    destroy: computation.getEvents().destroyed.subscribe(() => {
                        if (error) {
                            this._logger.warn('Search operation is failed');
                            reject(error);
                        } else {
                            reject(
                                new Error(
                                    this._logger.warn(
                                        'Search computation is destroyed, but it was not resolved/rejected',
                                    ),
                                ),
                            );
                        }
                    }),
                    matches: computation
                        .getEvents()
                        .matches.subscribe((matches: IMatchEntity[]) => {
                            if (error) {
                                this._logger.warn('Search operation is failed');
                                reject(error);
                            } else {
                                this._logger.debug('Search operation is successful');
                                resolve(matches);
                            }
                        }),
                    error: computation.getEvents().error.subscribe((err: IGeneralError) => {
                        this._logger.warn(`Error on operation append: ${err.message}`);
                        error = new Error(err.message);
                    }),
                    unsunscribe(): void {
                        subscriptions.destroy.destroy();
                        subscriptions.error.destroy();
                        subscriptions.matches.destroy();
                    },
                };
                this._logger.debug('Search operation is started');
                // Add cancel callback
                refCancelCB(() => {
                    // Cancelation is started, but not canceled
                    this._logger.debug(`Get command "break" operation. Starting breaking.`);
                    canceler();
                });
                // Handle finale of promise
                self.finally(() => {
                    this._logger.debug('Search operation promise is closed as well');
                    subscriptions.unsunscribe();
                });
                // Call operation
                const canceler: TCanceler = this._channel.search(computation.getEmitter(), filters);
            },
        );
    }

    public append(filename: string): CancelablePromise<void, void, void, void> {
        return new CancelablePromise<void, void, void, void>(
            (resolve, reject, cancel, refCancelCB, self) => {},
        );
    }

    public len(): number {
        const len = this._channel.getStreamLen();
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

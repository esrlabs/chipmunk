import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel } from '../native/index';
import { TCanceler } from '../native/native';
import { Subscription } from '../util/events.subscription';
import { ISearchFilter, IMatchEntity } from '../interfaces/index';
import {
    StreamSearchComputation,
} from './session.stream.search.computation';
import { IComputationError } from '../interfaces/errors';
import { IGeneralError } from '../interfaces/errors';

export const executor: TExecutor<IMatchEntity[], ISearchFilter[]> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    filters: ISearchFilter[],
): CancelablePromise<IMatchEntity[]> => {
    return new CancelablePromise<IMatchEntity[]>(
        (resolve, reject, cancel, refCancelCB, self) => {
            const computation: StreamSearchComputation = new StreamSearchComputation(
                uuid,
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
                        logger.warn('Search operation is failed');
                        reject(error);
                    } else {
                        reject(
                            new Error(
                                logger.warn(
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
                            logger.warn('Search operation is failed');
                            reject(error);
                        } else {
                            logger.debug('Search operation is successful');
                            resolve(matches);
                        }
                    }),
                error: computation.getEvents().error.subscribe((err: IComputationError) => {
                    logger.warn(`Error on operation search: ${err.message}`);
                    error = new Error(err.message);
                }),
                unsunscribe(): void {
                    subscriptions.destroy.destroy();
                    subscriptions.error.destroy();
                    subscriptions.matches.destroy();
                },
            };
            logger.debug('Search operation is started');
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                logger.debug(`Get command "break" operation. Starting breaking.`);
                (canceler as TCanceler)();
            });
            // Handle finale of promise
            self.finally(() => {
                logger.debug('Search operation promise is closed as well');
                subscriptions.unsunscribe();
            });
            // Call operation
            const canceler: TCanceler | IGeneralError = channel.search(computation.getEmitter(), filters);
            if (typeof canceler !== 'function') {
                return reject(new Error(`Fail to call search method due error: ${canceler.message}`));
            }
        },
    );
};

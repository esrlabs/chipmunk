import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel } from '../native/index';
import { TCanceler } from '../native/native';
import { Subscription } from '../util/events.subscription';
import { StreamMergeComputation, IFileToBeMerged } from './session.stream.merge.computation';
import { IComputationError } from '../interfaces/errors';
import { IGeneralError } from '../interfaces/errors';

export interface IExecuteMergeOptions {
    files: IFileToBeMerged[];
}

export const executor: TExecutor<void, IExecuteMergeOptions> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    options: IExecuteMergeOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamMergeComputation = new StreamMergeComputation(uuid);
        let error: Error | undefined;
        // Setup subscriptions
        const subscriptions: {
            destroy: Subscription;
            error: Subscription;
            unsunscribe(): void;
        } = {
            destroy: computation.getEvents().destroyed.subscribe(() => {
                if (error) {
                    logger.warn('Merge operation is failed');
                    reject(error);
                } else {
                    logger.debug('Merge operation is successful');
                    resolve();
                }
            }),
            error: computation.getEvents().error.subscribe((err: IComputationError) => {
                logger.warn(`Error on operation append: ${err.message}`);
                error = new Error(err.message);
            }),
            unsunscribe(): void {
                subscriptions.destroy.destroy();
                subscriptions.error.destroy();
            },
        };
        logger.debug('Merge operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.debug(`Get command "break" operation. Starting breaking.`);
            (canceler as TCanceler)();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Merge operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        const canceler: TCanceler | IGeneralError = channel.merge(computation.getEmitter(), options.files);
        if (typeof canceler !== 'function') {
            return reject(new Error(`Fail to call merge method due error: ${canceler.message}`));
        }
    });
};

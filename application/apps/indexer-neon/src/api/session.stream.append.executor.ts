import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel } from '../native/index';
import { TCanceler } from '../native/native';
import { Subscription } from '../util/events.subscription';
import {
    StreamAppendComputation,
    IExecuteAppendOptions,
} from './session.stream.append.computation';
import { IComputationError } from '../interfaces/errors';

export const executor: TExecutor<void, IExecuteAppendOptions> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    options: IExecuteAppendOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamAppendComputation = new StreamAppendComputation(uuid);
        channel.append(computation.getEmitter(), options.filename, options.options);
        let error: Error | undefined;
        // Setup subscriptions
        const subscriptions: {
            destroy: Subscription;
            error: Subscription;
            unsunscribe(): void;
        } = {
            destroy: computation.getEvents().destroyed.subscribe(() => {
                if (error) {
                    logger.warn('Append operation is failed');
                    reject(error);
                } else {
                    logger.debug('Append operation is successful');
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
        logger.debug('Append operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.debug(`Get command "break" operation. Starting breaking.`);
            canceler();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Append operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        const canceler: TCanceler = channel.append(computation.getEmitter(), options.filename, options.options);
    });
};

import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel } from '../native/index';
import { TCanceler } from '../native/native';
import { Subscription } from '../util/events.subscription';
import { StreamExportComputation, IExportOptions } from './session.stream.export.computation';
import { IComputationError } from '../interfaces/errors';
import { IGeneralError } from '../interfaces/errors';

export const executor: TExecutor<void, IExportOptions> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    options: IExportOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamExportComputation = new StreamExportComputation(uuid);
        let error: Error | undefined;
        // Setup subscriptions
        const subscriptions: {
            destroy: Subscription;
            error: Subscription;
            unsunscribe(): void;
        } = {
            destroy: computation.getEvents().destroyed.subscribe(() => {
                if (error) {
                    logger.warn('Export operation is failed');
                    reject(error);
                } else {
                    logger.debug('Export operation is successful');
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
        logger.debug('Export operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.debug(`Get command "break" operation. Starting breaking.`);
            (canceler as TCanceler)();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Export operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        const canceler: TCanceler | IGeneralError = channel.export(computation.getEmitter(), options);
        if (typeof canceler !== 'function') {
            return reject(new Error(`Fail to call export method due error: ${canceler.message}`));
        }
    });
};

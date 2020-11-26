import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustExportOperationChannel, RustExportOperationChannelConstructor } from '../native/index';
import { Subscription } from '../util/events.subscription';
import { StreamExportComputation, IExportOptions } from './session.stream.export.computation';
import { IError, EErrorSeverity } from '../interfaces/computation.minimal';

export const executor: TExecutor<void, IExportOptions> = (
    logger: Logger,
    uuid: string,
    options: IExportOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamExportComputation = new StreamExportComputation(uuid);
        const channel: RustExportOperationChannel = new RustExportOperationChannelConstructor(computation.getEmitter());
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
            error: computation.getEvents().error.subscribe((err: IError) => {
                logger.warn(`Error on operation append: ${err.content}`);
                error = new Error(err.content);
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
            // Destroy computation manually
            computation.destroy().catch((err: Error) => {
                logger.warn(
                    `Fail to destroy correctly computation instance for "append" operation due error: ${err.message}`,
                );
            });
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Export operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        channel.export(uuid, options);
    });
};

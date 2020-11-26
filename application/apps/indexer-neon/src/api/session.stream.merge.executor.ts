import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustMergeOperationChannel, RustMergeOperationChannelConstructor } from '../native/index';
import { Subscription } from '../util/events.subscription';
import { StreamMergeComputation, IFileToBeMerged } from './session.stream.merge.computation';
import { IError, EErrorSeverity } from '../interfaces/computation.minimal';

export interface IExecuteMergeOptions {
    files: IFileToBeMerged[];
}

export const executor: TExecutor<void, IExecuteMergeOptions> = (
    logger: Logger,
    uuid: string,
    options: IExecuteMergeOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamMergeComputation = new StreamMergeComputation(uuid);
        const channel: RustMergeOperationChannel = new RustMergeOperationChannelConstructor(computation.getEmitter());
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
            error: computation.getEvents().error.subscribe((err: IError) => {
                logger.warn(`Error on operation append: ${err.content}`);
                error = new Error(err.content);
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
            // Destroy computation manually
            computation.destroy().catch((err: Error) => {
                logger.warn(
                    `Fail to destroy correctly computation instance for "append" operation due error: ${err.message}`,
                );
            });
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Merge operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        channel.merge(uuid, options.files);
    });
};

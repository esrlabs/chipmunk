import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustConcatOperationChannel, RustConcatOperationChannelConstructor } from '../native/index';
import { Subscription } from '../util/events.subscription';
import { StreamConcatComputation } from './session.stream.concat.computation';
import { IError, EErrorSeverity } from '../interfaces/computation.minimal';

export interface IExecuteConcatOptions {
    files: string[];
}

export const executor: TExecutor<void, IExecuteConcatOptions> = (
    logger: Logger,
    uuid: string,
    options: IExecuteConcatOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamConcatComputation = new StreamConcatComputation(uuid);
        const channel: RustConcatOperationChannel = new RustConcatOperationChannelConstructor(computation.getEmitter());
        let error: Error | undefined;
        // Setup subscriptions
        const subscriptions: {
            destroy: Subscription;
            error: Subscription;
            unsunscribe(): void;
        } = {
            destroy: computation.getEvents().destroyed.subscribe(() => {
                if (error) {
                    logger.warn('Concat operation is failed');
                    reject(error);
                } else {
                    logger.debug('Concat operation is successful');
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
        logger.debug('Concat operation is started');
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
            logger.debug('Concat operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        channel.concat(uuid, options.files);
    });
};

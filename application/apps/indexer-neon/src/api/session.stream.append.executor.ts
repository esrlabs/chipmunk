import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustAppendOperationChannel, RustAppendOperationChannelConstructor } from '../native/index';
import { Subscription } from '../util/events.subscription';
import { StreamAppendComputation } from './session.stream.append.computation';
import { TFileOptions } from '../native/native.session.stream.append';
import { IError, EErrorSeverity } from '../interfaces/computation.minimal';

export interface IExecuteAppendOptions {
    filename: string;
    options: TFileOptions;
}

export const executor: TExecutor<void, IExecuteAppendOptions> = (
    logger: Logger,
    uuid: string,
    options: IExecuteAppendOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamAppendComputation = new StreamAppendComputation(uuid);
        const channel: RustAppendOperationChannel = new RustAppendOperationChannelConstructor(computation.getEmitter());
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
            error: computation.getEvents().error.subscribe((err: IError) => {
                logger.warn(`Error on operation append: ${err.content}`);
                error = new Error(err.content);
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
            // Destroy computation manually
            computation.destroy().catch((err: Error) => {
                logger.warn(
                    `Fail to destroy correctly computation instance for "append" operation due error: ${err.message}`,
                );
            });
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Append operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        channel.append(uuid, options.filename, options.options);
    });
};

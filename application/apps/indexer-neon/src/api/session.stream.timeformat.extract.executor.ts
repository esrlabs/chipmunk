import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustTimeFormatExtractOperationChannel, RustTimeFormatExtractOperationChannelConstructor } from '../native/index';
import { Subscription } from '../util/events.subscription';
import { StreamTimeFormatExtractComputation, IExtractDTFormatResult, IExtractOptions } from './session.stream.timeformat.extract.computation';
import { IError, EErrorSeverity } from '../interfaces/computation.minimal';

export const executor: TExecutor<IExtractDTFormatResult, IExtractOptions> = (
    logger: Logger,
    uuid: string,
    options: IExtractOptions,
): CancelablePromise<IExtractDTFormatResult> => {
    return new CancelablePromise<IExtractDTFormatResult>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamTimeFormatExtractComputation = new StreamTimeFormatExtractComputation(uuid);
        const channel: RustTimeFormatExtractOperationChannel = new RustTimeFormatExtractOperationChannelConstructor(computation.getEmitter());
        let error: Error | undefined;
        // Setup subscriptions
        const subscriptions: {
            destroy: Subscription;
            error: Subscription;
            unsunscribe(): void;
        } = {
            destroy: computation.getEvents().destroyed.subscribe(() => {
                if (error) {
                    logger.warn('Timeformat detect operation is failed');
                    reject(error);
                } else {
                    logger.debug('Timeformat detect operation is successful');
                    resolve({
                        format: '',
                        reg: '',
                    });
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
        logger.debug('Timeformat detect operation is started');
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
            logger.debug('Timeformat detect operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        channel.extract(uuid);
    });
};

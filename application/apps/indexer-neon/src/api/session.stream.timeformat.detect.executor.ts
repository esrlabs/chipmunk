import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustTimeFormatDetectOperationChannel, RustTimeFormatDetectOperationChannelConstructor } from '../native/index';
import { Subscription } from '../util/events.subscription';
import { StreamTimeFormatDetectComputation, IDetectDTFormatResult, IDetectOptions } from './session.stream.timeformat.detect.computation';
import { IError, EErrorSeverity } from '../interfaces/computation.minimal';

export const executor: TExecutor<IDetectDTFormatResult, IDetectOptions> = (
    logger: Logger,
    uuid: string,
    options: IDetectOptions,
): CancelablePromise<IDetectDTFormatResult> => {
    return new CancelablePromise<IDetectDTFormatResult>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamTimeFormatDetectComputation = new StreamTimeFormatDetectComputation(uuid);
        const channel: RustTimeFormatDetectOperationChannel = new RustTimeFormatDetectOperationChannelConstructor(computation.getEmitter());
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
        channel.detect(uuid);
    });
};

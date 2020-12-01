import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel } from '../native/index';
import { TCanceler } from '../native/native';
import { Subscription } from '../util/events.subscription';
import { StreamTimeFormatDetectComputation, IDetectDTFormatResult, IDetectOptions } from './session.stream.timeformat.detect.computation';
import { IComputationError } from '../interfaces/errors';
import { IGeneralError } from '../interfaces/errors';

export const executor: TExecutor<IDetectDTFormatResult, IDetectOptions> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    options: IDetectOptions,
): CancelablePromise<IDetectDTFormatResult> => {
    return new CancelablePromise<IDetectDTFormatResult>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamTimeFormatDetectComputation = new StreamTimeFormatDetectComputation(uuid);
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
            error: computation.getEvents().error.subscribe((err: IComputationError) => {
                logger.warn(`Error on operation append: ${err.message}`);
                error = new Error(err.message);
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
            (canceler as TCanceler)();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Timeformat detect operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        const canceler: TCanceler | IGeneralError = channel.detect(computation.getEmitter(), options);
        if (typeof canceler !== 'function') {
            return reject(new Error(`Fail to call detect method due error: ${canceler.message}`));
        }
    });
};

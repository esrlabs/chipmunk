import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel} from '../native/index';
import { TCanceler } from '../native/native';
import { Subscription } from '../util/events.subscription';
import { StreamConcatComputation } from './session.stream.concat.computation';
import { IComputationError } from '../interfaces/errors';
import { IGeneralError } from '../interfaces/errors';

export interface IExecuteConcatOptions {
    files: string[];
}

export const executor: TExecutor<void, IExecuteConcatOptions> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    options: IExecuteConcatOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamConcatComputation = new StreamConcatComputation(uuid);
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
            error: computation.getEvents().error.subscribe((err: IComputationError) => {
                logger.warn(`Error on operation append: ${err.message}`);
                error = new Error(err.message);
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
            (canceler as TCanceler)();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Concat operation promise is closed as well');
            subscriptions.unsunscribe();
        });
        // Call operation
        const canceler: TCanceler | IGeneralError = channel.concat(computation.getEmitter(), options.files);
        if (typeof canceler !== 'function') {
            return reject(new Error(`Fail to call concat method due error: ${canceler.message}`));
        }
    });
};

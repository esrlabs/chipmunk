import { TExecutor, Logger, CancelablePromise } from './executor';
import { RustSessionChannel } from '../native/index';
import { Subscription } from '../util/events.subscription';
import {
    StreamAssignComputation,
    IExecuteAssignOptions,
} from './session.stream.assign.provider';
import { IProviderError } from '../provider/provider.errors';
import { IGeneralError } from '../interfaces/errors';

export const executor: TExecutor<void, IExecuteAssignOptions> = (
    channel: RustSessionChannel,
    logger: Logger,
    uuid: string,
    options: IExecuteAssignOptions,
): CancelablePromise<void> => {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const computation: StreamAssignComputation = new StreamAssignComputation(uuid);
        let error: Error | undefined;
        // Setup subscriptions
        const lifecircle: {
            canceled: boolean,
            destroy: Subscription;
            error: Subscription;
            cancel(): void,
            unsunscribe(): void;
        } = {
            canceled: false,
            destroy: computation.getEvents().destroyed.subscribe(() => {
                if (error) {
                    logger.warn('Assign operation is failed');
                    reject(error);
                } else if (lifecircle.canceled) {
                    logger.debug('Assign operation is canceled');
                    cancel();
                } else {
                    logger.debug('Assign operation is successful');
                    resolve();
                }
            }),
            error: computation.getEvents().error.subscribe((err: IProviderError) => {
                logger.warn(`Error on operation append: ${err.message}`);
                error = new Error(err.message);
            }),
            unsunscribe(): void {
                lifecircle.destroy.destroy();
                lifecircle.error.destroy();
            },
            cancel(): void {
                if (lifecircle.canceled) {
                    logger.warn(`Operation has been already canceled`);
                    return;
                }
                lifecircle.canceled = true;
                /**
                 * We do not need to listen event "done" for cancelation of this operation
                 * because we are listening event "destroyed" in the scope of operation's
                 * computation object
                 */
                channel.abort(opUuid);
            }
        };
        logger.debug('Assign operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.debug(`Get command "break" operation. Starting breaking.`);
            lifecircle.cancel();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Assign operation promise is closed as well');
            lifecircle.unsunscribe();
        });
        // Call operation
        const opUuid: string | IGeneralError = channel.assign(computation.getEmitter(), options.filename, options.options);
        if (typeof opUuid !== 'string') {
            return reject(new Error(`Fail to call assign method due error: ${opUuid.message}`));
        }
    });
};

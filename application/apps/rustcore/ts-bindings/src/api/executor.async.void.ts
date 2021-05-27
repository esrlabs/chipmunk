import { Logger } from '../util/logging';
import { CancelablePromise } from '../util/promise';
import { RustSession } from '../native/native.session';
import { EventProvider, IErrorEvent, IOperationDoneEvent } from './session.provider';
import { Subscription } from '../util/events.subscription';
import { v4 as uuidv4 } from 'uuid';
import { NativeError } from '../interfaces/errors';

export type TOperationRunner<TOptions> = (session: RustSession, options: TOptions, operationUuid: string) => Promise<void>;

// TODO: should be implemented timeout to prevent memory leaking
export function AsyncVoidExecutor<TOptions>(
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: TOptions,
    runner: TOperationRunner<TOptions>,
    name: string, 
): CancelablePromise<void> {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        let error: Error | undefined;
        // Setup subscriptions
        const lifecircle: {
            canceled: boolean;
            destroy: Subscription;
            error: Subscription;
            done: Subscription;
            cancel(): void;
            unsunscribe(): void;
        } = {
            canceled: false,
            destroy: provider.getEvents().SessionDestroyed.subscribe(() => {
                reject(new Error(logger.warn('Session was destroyed')));
            }),
            error: provider.getEvents().OperationError.subscribe((event: IErrorEvent) => {
                if (event.uuid !== opUuid) {
                    return; // Ignore. This is another operation
                }
                logger.warn(`Error on operation "${name}": ${event.error.message}`);
                error = new Error(event.error.message);
            }),
            done: provider.getEvents().OperationDone.subscribe((event: IOperationDoneEvent) => {
                if (event.uuid !== opUuid) {
                    return; // Ignore. This is another operation
                }
                if (error instanceof Error) {
                    reject(error);
                } else if (lifecircle.canceled) {
                    cancel();
                } else {
                    resolve(undefined);
                }
            }),
            unsunscribe(): void {
                lifecircle.destroy.destroy();
                lifecircle.error.destroy();
                lifecircle.done.destroy();
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
                let error: NativeError | undefined = session.abort(opUuid);
                if (error instanceof NativeError) {
                    lifecircle.canceled = false;
                    self.stopCancelation();
                    reject(new Error(`Fail to cancel operation. Error: ${error.message}`));
                }
            },
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
        const opUuid: string = uuidv4();
        runner(session, options, opUuid).catch((err: Error) => {
            if (self.isProcessing()) {
                reject(new Error(`Fail to run "${name}" operation due error: ${err.message}`));
            }
        });
    });
}

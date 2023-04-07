import { Logger } from 'platform/log';
import { CancelablePromise } from 'platform/env/promise';
import { RustSession } from '../../native/native.session';
import { EventProvider, IErrorEvent, IOperationDoneEvent } from '../../api/session.provider';
import { Subscription } from 'platform/env/subscription';
import { v4 as uuidv4 } from 'uuid';
import { NativeError } from '../../interfaces/errors';

export type TOperationRunner<TOptions> = (
    session: RustSession,
    options: TOptions,
) => string | Error;

// TODO: should be implemented timeout to prevent memory leaking
export function VoidExecutor<TOptions>(
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: TOptions,
    runner: TOperationRunner<TOptions>,
    name: string,
): CancelablePromise<void> {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        // Setup subscriptions
        const lifecircle: {
            abortOperationId: string | undefined;
            destroy: Subscription;
            error: Subscription;
            done: Subscription;
            cancel(): void;
            unsunscribe(): void;
        } = {
            abortOperationId: undefined,
            destroy: provider.getEvents().SessionDestroyed.subscribe(() => {
                reject(new Error(logger.warn('Session was destroyed')));
            }),
            error: provider.getEvents().OperationError.subscribe((event: IErrorEvent) => {
                if (event.uuid !== opUuid) {
                    return; // Ignore. This is another operation
                }
                logger.warn(`Error on operation "${name}": ${event.error.message}`);
                reject(new Error(event.error.message));
            }),
            done: provider.getEvents().OperationDone.subscribe((event: IOperationDoneEvent) => {
                if (event.uuid !== opUuid && event.uuid !== lifecircle.abortOperationId) {
                    return; // Ignore. This is another operation
                }
                if (event.uuid === lifecircle.abortOperationId) {
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
                if (lifecircle.abortOperationId !== undefined) {
                    logger.warn(`Operation has been already canceled`);
                    return;
                }
                /**
                 * We do not need to listen event "done" for cancelation of this operation
                 * because we are listening event "destroyed" in the scope of operation's
                 * computation object
                 */
                lifecircle.abortOperationId = uuidv4();
                const state: NativeError | undefined = session.abort(
                    lifecircle.abortOperationId,
                    opUuid,
                );
                if (state instanceof NativeError) {
                    logger.error(`Fail to cancel operation ${opUuid}; error: ${state.message}`);
                    if (!self.tryToStopCancellation()) {
                        logger.error(
                            `Cancellation procudure of operation ${opUuid}; could not be stopped: promise had been cancelled already`,
                        );
                    } else {
                        lifecircle.abortOperationId = undefined;
                        reject(new Error(`Fail to cancel operation. Error: ${state.message}`));
                    }
                } else {
                    logger.debug(`Cancel signal for operation ${opUuid} has been sent`);
                }
            },
        };
        logger.verbose('Sync void operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.verbose(`Get command "break" operation. Starting breaking.`);
            lifecircle.cancel();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.verbose('Sync void operation promise is closed as well');
            lifecircle.unsunscribe();
        });
        // Call operation
        const opUuid: string = (() => {
            const _: string | Error = runner(session, options);
            if (_ instanceof Error) {
                lifecircle.unsunscribe();
                reject(new Error(`Fail to run "${name}" operation due error: ${_.message}`));
                return '';
            } else {
                return _;
            }
        })();
    });
}

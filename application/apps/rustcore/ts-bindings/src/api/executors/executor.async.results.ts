import { Logger } from '../../util/logging';
import { CancelablePromise } from 'platform/env/promise';
import { RustSession } from '../../native/native.session';
import { EventProvider, IErrorEvent, IOperationDoneEvent } from '../../api/session.provider';
import { v4 as uuidv4 } from 'uuid';
import { NativeError } from '../../interfaces/errors';
import { Subscription } from 'platform/env/subscription';

export type TOperationRunner<TOptions> = (
    session: RustSession,
    options: TOptions,
    operationUuid: string,
) => Promise<void>;

export type TOperationResultReader<TResult> = (
    result: any,
    resolve: (res: TResult) => void,
    reject: (err: Error) => void,
) => void;

// TODO: should be implemented timeout to prevent memory leaking
export function AsyncResultsExecutor<TResult, TOptions>(
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: TOptions,
    runner: TOperationRunner<TOptions>,
    reader: TOperationResultReader<TResult>,
    name: string,
): CancelablePromise<TResult> {
    return new CancelablePromise<TResult>((resolve, reject, cancel, refCancelCB, self) => {
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
                logger.debug('Async result operation state: destroy');
                reject(new Error(logger.warn(`Session was destroyed. Operation: ${self.uuid()}`)));
            }),
            error: provider.getEvents().OperationError.subscribe((event: IErrorEvent) => {
                logger.verbose('Async result operation state: error');
                if (event.uuid !== self.uuid()) {
                    return; // Ignore. This is another operation
                }
                logger.warn(
                    `Error on operation "${name}":\n${'-'.repeat(40)}\n${
                        event.error.message
                    }\n${'-'.repeat(40)}`,
                );
                reject(new Error(event.error.message));
            }),
            done: provider.getEvents().OperationDone.subscribe((event: IOperationDoneEvent) => {
                logger.verbose('Async result operation state: done');
                if (event.uuid !== self.uuid() && event.uuid !== lifecircle.abortOperationId) {
                    return; // Ignore. This is another operation
                }
                if (event.uuid === lifecircle.abortOperationId) {
                    cancel();
                } else {
                    reader(event.result, resolve, reject);
                }
            }),
            unsunscribe(): void {
                lifecircle.destroy.destroy();
                lifecircle.error.destroy();
                lifecircle.done.destroy();
            },
            cancel(): void {
                logger.verbose('Async result operation state: cancel');
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
                    self.uuid(),
                );
                if (state instanceof NativeError) {
                    logger.error(
                        `Fail to cancel operation ${self.uuid()}; error: ${state.message}`,
                    );
                    if (!self.tryToStopCancellation()) {
                        logger.error(
                            `Cancellation procudure of operation ${self.uuid()}; could not be stopped: promise had been cancelled already`,
                        );
                    } else {
                        lifecircle.abortOperationId = undefined;
                        reject(new Error(`Fail to cancel operation. Error: ${state.message}`));
                    }
                } else {
                    logger.debug(`Cancel signal for operation ${self.uuid()} has been sent`);
                }
            },
        };
        logger.verbose('Async result operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.verbose(`Get command "break" operation. Starting breaking.`);
            lifecircle.cancel();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.verbose('Async result operation promise is closed as well');
            lifecircle.unsunscribe();
        });
        // Call operation
        runner(session, options, self.uuid()).catch((err: Error) => {
            if (self.isProcessing()) {
                logger.debug('Async result operation state: rejecting because is in progress');
                reject(
                    new Error(
                        `Fail to run "${name}" operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            }
        });
    });
}

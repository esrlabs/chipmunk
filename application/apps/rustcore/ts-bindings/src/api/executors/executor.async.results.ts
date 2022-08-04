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
                reject(new Error(logger.warn(`Session was destroyed. Operation: ${opUuid}`)));
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
                    reader(event.result, resolve, reject);
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
                    lifecircle.abortOperationId = undefined;
                    self.stopCancelation();
                    logger.error(`Fail to cancel operation ${opUuid}; error: ${state.message}`);
                    reject(new Error(`Fail to cancel operation. Error: ${state.message}`));
                } else {
                    logger.debug(`Cancel signal for operation ${opUuid} has been sent`);
                }
            },
        };
        logger.debug('Async result operation is started');
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.debug(`Get command "break" operation. Starting breaking.`);
            lifecircle.cancel();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.debug('Async result operation promise is closed as well');
            lifecircle.unsunscribe();
        });
        // Call operation
        const opUuid: string = self.uuid();
        runner(session, options, opUuid).catch((err: Error) => {
            if (self.isProcessing()) {
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

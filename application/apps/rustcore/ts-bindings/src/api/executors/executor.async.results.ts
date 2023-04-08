import { Logger, utils } from 'platform/log';
import { cutUuid } from 'platform/log/utils';
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
        const signature = `${name} (${cutUuid(self.uuid())})`;
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
                reject(new Error(logger.warn(`${signature}: session was destroyed`)));
            }),
            error: provider.getEvents().OperationError.subscribe((event: IErrorEvent) => {
                if (event.uuid !== self.uuid()) {
                    return; // Ignore. This is another operation
                }
                logger.warn(`${signature}: (event) error ${event.error.message}`);
                reject(new Error(event.error.message));
            }),
            done: provider.getEvents().OperationDone.subscribe((event: IOperationDoneEvent) => {
                if (event.uuid !== self.uuid() && event.uuid !== lifecircle.abortOperationId) {
                    return; // Ignore. This is another operation
                }
                logger.verbose(`${signature}: (event) done`);
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
                logger.verbose(`${signature}: cancel`);
                if (lifecircle.abortOperationId !== undefined) {
                    logger.warn(`${signature}: already canceled`);
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
                    logger.error(`${signature}: fail to cancel; error: ${state.message}`);
                    if (!self.tryToStopCancellation()) {
                        logger.error(
                            `${signature}: cancellation procudure of operation could not be stopped: promise had been cancelled already`,
                        );
                    } else {
                        lifecircle.abortOperationId = undefined;
                        reject(new Error(`Fail to cancel operation. Error: ${state.message}`));
                    }
                } else {
                    logger.debug(`${signature}: cancel signal has been sent`);
                }
            },
        };
        logger.verbose(`${signature}: started`);
        // Add cancel callback
        refCancelCB(() => {
            // Cancelation is started, but not canceled
            logger.verbose(`${signature}: breaking.`);
            lifecircle.cancel();
        });
        // Handle finale of promise
        self.finally(() => {
            logger.verbose(`${signature}: finished`);
            lifecircle.unsunscribe();
        });
        // Call operation
        runner(session, options, self.uuid()).catch((err: Error) => {
            if (self.isProcessing()) {
                reject(new Error(logger.error(`${signature}: fail to run: ${utils.error(err)}`)));
            }
        });
    });
}

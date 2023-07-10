import { Logger, utils } from 'platform/log';
import { cutUuid } from 'platform/log/utils';
import { CancelablePromise, ICancelablePromise, TCanceler } from 'platform/env/promise';
import { RustSession } from '../../native/native.session';
import { EventProvider, IErrorEvent, IOperationDoneEvent } from '../session.provider';
import { Subscriber } from 'platform/env/subscription';
import { v4 as uuidv4 } from 'uuid';
import { NativeError } from '../../interfaces/errors';

export type TOperationRunner<TOptions> = (
    session: RustSession,
    options: TOptions,
    operationUuid: string,
) => Promise<void>;

class LifeCycle extends Subscriber {
    protected abortOperationId: string | undefined;

    constructor(
        protected readonly session: RustSession,
        protected readonly provider: EventProvider,
        protected readonly logger: Logger,
        protected readonly signature: string,
        protected readonly resolve: () => void,
        protected readonly reject: (err: Error) => void,
        protected readonly cancel: (reason?: any) => void,
        protected readonly refCancelCB: (cb: TCanceler<void>) => void,
        protected readonly getDebugInfo: () => string,
        protected readonly task: ICancelablePromise<void>,
    ) {
        super();
        this.register(
            provider.getEvents().SessionDestroyed.subscribe(this.onSessionDestroyed.bind(this)),
        );
        this.register(
            provider.getEvents().OperationError.subscribe(this.onOperationError.bind(this)),
        );
        this.register(
            provider.getEvents().OperationDone.subscribe(this.onOperationDone.bind(this)),
        );
        this.register(
            provider.getEvents().OperationStarted.subscribe(this.onOperationStarted.bind(this)),
        );
        this.register(
            provider
                .getEvents()
                .OperationProcessing.subscribe(this.onOperationProcessing.bind(this)),
        );
        task.finally(() => {
            this.logger.verbose(`${signature}: finished`);
            this.unsubscribe();
        });
        refCancelCB(this.cancelling.bind(this));
    }

    protected onSessionDestroyed(): void {
        this.reject(new Error(this.logger.warn(`${this.signature}: session was destroyed`)));
    }

    protected onOperationError(event: IErrorEvent): void {
        if (event.uuid !== this.task.uuid() && event.uuid !== this.abortOperationId) {
            return; // Ignore. This is another operation
        }
        if (event.uuid === this.abortOperationId) {
            if (this.task.isCompleted()) {
                this.logger.warn(
                    `${this.signature}: cancellation was done with error: ${event.error.message}, but promise already completed.`,
                );
                return;
            }
            this.logger.error(
                `${this.signature}: cancellation was done with error: ${
                    event.error.message
                }, but promise wasn't completed; info: ${this.getDebugInfo()}`,
            );
        } else {
            this.logger.warn(
                `${this.signature}: (event) error ${
                    event.error.message
                }; info: ${this.getDebugInfo()}`,
            );
        }
        this.reject(new Error(event.error.message));
    }

    protected onOperationDone(event: IOperationDoneEvent): void {
        if (event.uuid !== this.task.uuid() && event.uuid !== this.abortOperationId) {
            return; // Ignore. This is another operation
        }
        this.logger.verbose(`${this.signature}: (event) done`);
        if (event.uuid === this.abortOperationId || this.abortOperationId !== undefined) {
            if (event.uuid !== this.abortOperationId) {
                this.logger.warn(
                    `${this.signature}: promise was canceled, but results comes first; promise will be canceled in any way`,
                );
            }
            this.cancel();
            return;
        }
        if (this.task.isCanceling()) {
            if (!this.task.tryToStopCancellation()) {
                this.logger.warn(`${this.signature}: promise had been cancelled already`);
                return;
            }
            this.logger.debug(`${this.signature}: cancellation is stopped`);
        }
        this.resolve();
    }

    protected onOperationStarted(uuid: string): void {
        if (uuid !== this.task.uuid()) {
            return;
        }
        this.logger.verbose(`${this.signature}: (event) confirmed; info: ${this.getDebugInfo()}`);
        this.task.emit('confirmed');
    }

    protected onOperationProcessing(uuid: string): void {
        if (uuid !== this.task.uuid()) {
            return;
        }
        this.logger.verbose(`${this.signature}: (event) processing`);
        this.task.emit('processing');
    }

    protected cancelling(): void {
        this.logger.verbose(`${this.signature}: canceling`);
        if (this.abortOperationId !== undefined) {
            this.logger.warn(`${this.signature}: already canceled`);
            return;
        }
        /**
         * We do not need to listen event "done" for cancelation of this operation
         * because we are listening event "destroyed" in the scope of operation's
         * computation object
         */
        this.abortOperationId = uuidv4();
        const state: NativeError | undefined = this.session.abort(
            this.abortOperationId,
            this.task.uuid(),
        );
        if (state instanceof NativeError) {
            this.logger.error(`${this.signature}: fail to cancel; error: ${state.message}`);
            if (!this.task.tryToStopCancellation()) {
                this.logger.error(
                    `${this.signature}: cancellation procudure of operation could not be stopped: promise had been cancelled already`,
                );
            } else {
                this.abortOperationId = undefined;
                this.reject(new Error(`Fail to cancel operation. Error: ${state.message}`));
            }
            return;
        }
        this.logger.debug(`${this.signature}: cancel signal has been sent`);
    }
}

export function AsyncVoidConfirmedExecutor<TOptions>(
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: TOptions,
    runner: TOperationRunner<TOptions>,
    getDebugInfo: () => string,
    name: string,
): CancelablePromise<void> {
    return new CancelablePromise<void>((resolve, reject, cancel, refCancelCB, self) => {
        const signature = `${name} (${cutUuid(self.uuid())})`;
        // Setup subscriptions
        new LifeCycle(
            session,
            provider,
            logger,
            signature,
            resolve,
            reject,
            cancel,
            refCancelCB,
            getDebugInfo,
            self,
        );
        logger.verbose(`${signature}: started`);
        runner(session, options, self.uuid()).catch((err: Error) => {
            if (self.isProcessing()) {
                reject(new Error(logger.error(`${signature}: fail to run: ${utils.error(err)}`)));
            }
        });
    });
}

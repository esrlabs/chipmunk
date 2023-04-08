import { Logger } from 'platform/log';
import { CancelablePromise } from 'platform/env/promise';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
export { Logger, CancelablePromise };

export type TExecutor<TReturn, TOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: TOptions,
) => CancelablePromise<TReturn>;

export { AsyncResultsExecutor } from './executor.async.results';
export { AsyncVoidConfirmedExecutor } from './executor.async.void.confirmed';

import { Logger } from '../../util/logging';
import { CancelablePromise } from '../../util/promise';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
export { Logger, CancelablePromise };

export type TExecutor<TReturn, TOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: TOptions,
) => CancelablePromise<TReturn>;

export { VoidExecutor } from './executor.sync.void';
export { ResultsExecutor } from './executor.sync.results';
export { AsyncVoidExecutor } from './executor.async.void';
export { AsyncResultsExecutor } from './executor.async.results';

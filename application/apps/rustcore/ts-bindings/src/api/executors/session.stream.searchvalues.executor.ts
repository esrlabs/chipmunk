import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../session.provider';

export const executor: TExecutor<void, string[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: string[],
): CancelablePromise<void> => {
    return AsyncResultsExecutor<void, string[]>(
        session,
        provider,
        logger,
        filters,
        function (session: RustSession, filters: string[], operationUuid: string): Promise<void> {
            return session.searchValues(filters, operationUuid);
        },
        function (_data: Uint8Array, resolve: () => void, _reject: (err: Error) => void) {
            resolve();
        },
        'search_values',
    );
};

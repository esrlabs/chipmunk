import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { IFilter } from 'platform/types/filter';

import * as protocol from 'protocol';

export const executor: TExecutor<number, IFilter[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: IFilter[],
): CancelablePromise<number> => {
    return AsyncResultsExecutor<number, IFilter[]>(
        session,
        provider,
        logger,
        filters,
        function (session: RustSession, filters: IFilter[], operationUuid: string): Promise<void> {
            return session.search(filters, operationUuid);
        },
        function (
            data: Uint8Array,
            resolve: (found: number) => void,
            reject: (err: Error) => void,
        ) {
            const found: number = protocol.decodeResultU64(data);
            if (typeof found !== 'number' || isNaN(found) || !isFinite(found)) {
                return reject(
                    new Error(
                        `Fail to parse search results. Invalid format. Expecting valid { number }.`,
                    ),
                );
            }
            resolve(found);
        },
        'search',
    );
};

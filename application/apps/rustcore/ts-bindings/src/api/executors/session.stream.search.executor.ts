import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { IFilter, ISearchResults } from '../../interfaces/index';

export const executor: TExecutor<ISearchResults, IFilter[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: IFilter[],
): CancelablePromise<ISearchResults> => {
    return AsyncResultsExecutor<ISearchResults, IFilter[]>(
        session,
        provider,
        logger,
        filters,
        function (session: RustSession, filters: IFilter[], operationUuid: string): Promise<void> {
            return session.search(filters, operationUuid);
        },
        function (data: any, resolve: (res: ISearchResults) => void, reject: (err: Error) => void) {
            try {
                const result: ISearchResults = JSON.parse(data);
                if (typeof result.found !== 'number' || !(result.stats instanceof Array)) {
                    return reject(
                        new Error(
                            `Fail to parse search results. Invalid format. Expecting ISearchResults.`,
                        ),
                    );
                }
                resolve(result);
            } catch (err) {
                return reject(
                    new Error(
                        `Fail to parse search results. Error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            }
        },
        'search',
    );
};

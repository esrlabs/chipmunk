import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IFilter, ISearchResults } from '../interfaces/index';

export const executor: TExecutor<ISearchResults, IFilter[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: IFilter[],
): CancelablePromise<ISearchResults> => {
    return withResultsExecutor<ISearchResults, IFilter[]>(
        session,
        provider,
        logger,
        filters,
        function(session: RustSession, filters: IFilter[]): string | Error {
            const uuid: string | Error = session.search(filters);
            if (uuid instanceof Error) {
                return uuid;
            } else if (typeof uuid !== 'string') {
                return new Error(`Unexpected format of output of "search". Expecting {uuid}; get: ${uuid}`);
            } else {
                return uuid;
            };
        },
        function(data: any, resolve: (res: ISearchResults) => void, reject: (err: Error) => void) {
            try {
                const result: ISearchResults = JSON.parse(data);
                if (typeof result.found !== 'number' || !(result.stats instanceof Array)) {
                    return reject(new Error(`Fail to parse search results. Invalid format. Expecting ISearchResults.`));
                }
                resolve(result);
            } catch (e) {
                return reject(new Error(`Fail to parse search results. Error: ${e.message}`));
            }
        },
        "search",
    );
};

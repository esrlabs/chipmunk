import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';
import { IFilter, IResultSearchElement } from '../interfaces/index';

export const executor: TExecutor<IResultSearchElement[], IFilter[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: IFilter[],
): CancelablePromise<IResultSearchElement[]> => {
    return withResultsExecutor<IResultSearchElement[], IFilter[]>(
        session,
        provider,
        logger,
        filters,
        function(session: RustSession, filters: IFilter[]): string | Error {
            const uuid: string | IGeneralError = session.search(filters);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        function(result: any, resolve: (res: IResultSearchElement[]) => void, reject: (err: Error) => void) {
            if (!(result instanceof Array)) {
                return reject(new Error(`Operation: search. Expected result: { IResultSearchElement[] }. Has been gotten: typeof: ${typeof result}`));
            }
            resolve(result as IResultSearchElement[]);
        },
        "search",
    );
};

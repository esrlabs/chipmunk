import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';
import { IFilter, IMatchEntity } from '../interfaces/index';

export const executor: TExecutor<IMatchEntity[], IFilter[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: IFilter[],
): CancelablePromise<IMatchEntity[]> => {
    return withResultsExecutor<IMatchEntity[], IFilter[]>(
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
        function(result: any, resolve: (res: IMatchEntity[]) => void, reject: (err: Error) => void) {
            // TODO: implement result checks/convert
            resolve([])
        },
        "search",
    );
};

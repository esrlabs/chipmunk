import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IFilter, ISearchMap } from '../interfaces/index';

export interface IOptions {
    datasetLength: number;
    from?: number;
    to?: number;
}

export const executor: TExecutor<ISearchMap, IOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IOptions,
): CancelablePromise<ISearchMap> => {
    return withResultsExecutor<ISearchMap, IOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IOptions): string | Error {
            if (options.from !== undefined && options.to !== undefined) {
                if (isNaN(options.from) || isNaN(options.to) || !isFinite(options.from) || !isFinite(options.to)) {
                    return new Error(`Range is invalid`);
                }
                if (options.from > options.to) {
                    return new Error(`Range is invalid: "from" should not be less "to"`);
                }
            }
            const uuid: string | Error = session.getMap(
                options.datasetLength,
                options.from,
                options.to
            );
            if (uuid instanceof Error) {
                return uuid;
            } else if (typeof uuid !== 'string') {
                return new Error(`Unexpected format of output of "getMap". Expecting {uuid}; get: ${uuid}`);
            } else {
                return uuid;
            };
        },
        function(data: any, resolve: (res: ISearchMap) => void, reject: (err: Error) => void) {
            try {
                const result: ISearchMap = JSON.parse(data);
                if (!(result instanceof Array)) {
                    return reject(new Error(`Fail to parse search map. Invalid format. Expecting ISearchMap.`));
                }
                resolve(result);
            } catch (e) {
                return reject(new Error(`Fail to parse search map. Error: ${e.message}`));
            }
        },
        "search",
    );
};

import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/index';
import { EventProvider } from '../../api/session.provider';
import { IFileMergeOptions } from '../../interfaces/index';

export interface IExecuteMergeOptions {
    files: IFileMergeOptions[];
    append: boolean;
}

export interface IMergeResults {}

export const executor: TExecutor<IMergeResults, IExecuteMergeOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteMergeOptions,
): CancelablePromise<IMergeResults> => {
    return AsyncResultsExecutor<IMergeResults, IExecuteMergeOptions>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: IExecuteMergeOptions,
            operationUuid: string,
        ): Promise<void> {
            return session.merge(options.files, options.append, operationUuid);
        },
        function (data: any, resolve: (res: IMergeResults) => void, reject: (err: Error) => void) {
            try {
                const result: IMergeResults = JSON.parse(data);
                // if (typeof result.found !== 'number' || !(result.stats instanceof Array)) {
                //     return reject(new Error(`Fail to parse search results. Invalid format. Expecting ISearchResults.`));
                // }
                resolve(result);
            } catch (e) {
                return reject(
                    new Error(
                        `Fail to parse merge results. Error: ${e instanceof Error ? e.message : e}`,
                    ),
                );
            }
        },
        'merge',
    );
};

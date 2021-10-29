import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IConcatFile } from '../interfaces';

export interface IExecuteConcatOptions {
    files: IConcatFile[];
    append: boolean;
}
export interface IConcatResults {}

export const executor: TExecutor<IConcatResults, IExecuteConcatOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteConcatOptions,
): CancelablePromise<IConcatResults> => {
    return AsyncResultsExecutor<IConcatResults, IExecuteConcatOptions>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: IExecuteConcatOptions,
            operationUuid: string,
        ): Promise<void> {
            return session.concat(options.files, options.append, operationUuid);
        },
        function (data: any, resolve: (res: IConcatResults) => void, reject: (err: Error) => void) {
            try {
                const result: IConcatResults = JSON.parse(data);
                // if (typeof result.found !== 'number' || !(result.stats instanceof Array)) {
                //     return reject(new Error(`Fail to parse search results. Invalid format. Expecting ISearchResults.`));
                // }
                resolve(result);
            } catch (e) {
                return reject(
                    new Error(
                        `Fail to parse concat results. Error: ${
                            e instanceof Error ? e.message : e
                        }`,
                    ),
                );
            }
        },
        'concat',
    );
};

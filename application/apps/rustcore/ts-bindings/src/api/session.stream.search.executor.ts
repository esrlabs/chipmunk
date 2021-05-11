// import { TExecutor, Logger, CancelablePromise, noResultsExecutor } from './executor';
// import { RustSession } from '../native/index';
// import { EventProvider } from './session.provider';
// import { IGeneralError } from '../interfaces/errors';
// import { IFilter, IResultSearchElement } from '../interfaces/index';

// export interface IFileOptionsDLT {}

// export enum EFileOptionsRequirements {
//     DLTOptions = 'DLTOptions',
//     NoOptionsRequired = 'NoOptionsRequires',
// }

// export type TFileOptions = IFileOptionsDLT | undefined;

// export interface IExecuteAssignOptions {
//     filename: string;
//     options: TFileOptions;
// }

// export const executor: TExecutor<void, IFilter[]> = (
//     session: RustSession,
//     provider: EventProvider,
//     logger: Logger,
//     filters: IFilter[],
// ): CancelablePromise<void> => {
//     return noResultsExecutor<IFilter[]>(
//         session,
//         provider,
//         logger,
//         filters,
//         function(session: RustSession, filters: IFilter[]): string | Error {
//             const uuid: string | IGeneralError = session.search(filters);
//             if (typeof uuid !== 'string') {
//                 return new Error(uuid.message);
//             } else {
//                 logger.debug(`Search started. Operation UUID: ${uuid}`);
//                 return uuid;
//             };
//         },
//         "search",
//     );
// };

import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';
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
            const uuid: string | IGeneralError = session.search(filters);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        function(data: any, resolve: (res: ISearchResults) => void, reject: (err: Error) => void) {
            try {
                const result: ISearchResults = JSON.parse(data);
                if (typeof result.found !== 'number' || typeof result.matches !== 'string') {
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

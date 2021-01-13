import { TExecutor, Logger, CancelablePromise, noResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';

export interface IExecuteMergeOptions {
    files: IFileToBeMerged[];
}

export interface IFileToBeMerged {
    filename: string;
    datetimeFormat?: string;
    datetimeFormatRegExp?: string;
}

export const executor: TExecutor<void, IExecuteMergeOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteMergeOptions,
): CancelablePromise<void> => {
    return noResultsExecutor<IExecuteMergeOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExecuteMergeOptions): string | Error {
            const uuid: string | IGeneralError = session.merge(options.files);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        "merge",
    );
};

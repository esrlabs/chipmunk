import { TExecutor, Logger, CancelablePromise, VoidExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';

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
    return VoidExecutor<IExecuteMergeOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExecuteMergeOptions): string | Error {
            return session.merge(options.files);
        },
        "merge",
    );
};

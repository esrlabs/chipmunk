import { TExecutor, Logger, CancelablePromise, noResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';

export interface IExportOptions {
    from: number;
    to: number;
    destFilename: string;
    keepFormat: boolean;
}

export const executor: TExecutor<void, IExportOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExportOptions,
): CancelablePromise<void> => {
    return noResultsExecutor<IExportOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExportOptions): string | Error {
            const uuid: string | IGeneralError = session.export(options);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        "export",
    );
};

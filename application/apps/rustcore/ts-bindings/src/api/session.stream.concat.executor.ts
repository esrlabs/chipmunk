import { TExecutor, Logger, CancelablePromise, noResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';

export interface IExecuteConcatOptions {
    files: string[];
}

export const executor: TExecutor<void, IExecuteConcatOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteConcatOptions,
): CancelablePromise<void> => {
    return noResultsExecutor<IExecuteConcatOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExecuteConcatOptions): string | Error {
            const uuid: string | IGeneralError = session.concat(options.files);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        "concat",
    );
};


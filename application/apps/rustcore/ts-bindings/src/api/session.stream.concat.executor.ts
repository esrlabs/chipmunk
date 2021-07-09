import { TExecutor, Logger, CancelablePromise, VoidExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';

export interface IExecuteConcatOptions {
    files: string[];
}

export const executor: TExecutor<void, IExecuteConcatOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteConcatOptions,
): CancelablePromise<void> => {
    return VoidExecutor<IExecuteConcatOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExecuteConcatOptions): string | Error {
            return session.concat(options.files);
        },
        "concat",
    );
};


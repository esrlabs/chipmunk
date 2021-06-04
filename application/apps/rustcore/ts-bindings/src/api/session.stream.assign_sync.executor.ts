// TO REMOVE: begin
import { TExecutor, Logger, CancelablePromise, VoidExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';

export interface IOptions {
    filename: string,
}

export const executor: TExecutor<void, IOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IOptions,
): CancelablePromise<void> => {
    return VoidExecutor<IOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IOptions): string | Error {
            return session.assignSync(options.filename);
        },
        "assign_sync",
    );
};
// TO REMOVE: end

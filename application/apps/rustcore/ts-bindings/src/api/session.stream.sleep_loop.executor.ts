// TO REMOVE: begin
import { TExecutor, Logger, CancelablePromise, VoidExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';

export interface IOptions {
    duration: number,
    onBusyLoop: boolean,
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
            return session.sleepLoop(options.duration, options.onBusyLoop);
        },
        "sleep_loop",
    );
};
// TO REMOVE: end

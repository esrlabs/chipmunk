import { TExecutor, Logger, CancelablePromise, AsyncVoidExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { Observe } from '../../interfaces/index';
export interface IFileOptionsDLT {}

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export const executor: TExecutor<void, Observe.DataSource> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: Observe.DataSource,
): CancelablePromise<void> => {
    return AsyncVoidExecutor<Observe.DataSource>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: Observe.DataSource,
            operationUuid: string,
        ): Promise<void> {
            return session.observe(options, operationUuid);
        },
        'observe',
    );
};

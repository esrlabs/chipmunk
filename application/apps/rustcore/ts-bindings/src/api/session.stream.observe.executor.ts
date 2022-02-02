import { TExecutor, Logger, CancelablePromise, AsyncVoidExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { DataSource } from '../interfaces/index';
export interface IFileOptionsDLT {}

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export const executor: TExecutor<void, DataSource> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: DataSource,
): CancelablePromise<void> => {
    return AsyncVoidExecutor<DataSource>(
        session,
        provider,
        logger,
        options,
        function (session: RustSession, options: DataSource, operationUuid: string): Promise<void> {
            return session.observe(options, operationUuid);
        },
        'observe',
    );
};

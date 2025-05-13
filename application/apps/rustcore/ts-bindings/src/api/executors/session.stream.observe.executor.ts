import { TExecutor, Logger, CancelablePromise, AsyncVoidConfirmedExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { SessionSetup } from 'platform/types/bindings';

export interface IFileOptionsDLT {}

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export const executor: TExecutor<void, SessionSetup> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: SessionSetup,
): CancelablePromise<void> => {
    const debugInfo = JSON.stringify(options);
    return AsyncVoidConfirmedExecutor<SessionSetup>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: SessionSetup,
            operationUuid: string,
        ): Promise<void> {
            return session.observe(options, operationUuid);
        },
        (): string => {
            return debugInfo;
        },
        'observe',
    );
};

import { TExecutor, Logger, CancelablePromise, AsyncVoidConfirmedExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { IObserve } from 'platform/types/observe';

export interface IFileOptionsDLT {}

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export const executor: TExecutor<void, IObserve> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IObserve,
): CancelablePromise<void> => {
    return AsyncVoidConfirmedExecutor<IObserve>(
        session,
        provider,
        logger,
        options,
        function (session: RustSession, options: IObserve, operationUuid: string): Promise<void> {
            return session.observe(options, operationUuid);
        },
        'observe',
    );
};

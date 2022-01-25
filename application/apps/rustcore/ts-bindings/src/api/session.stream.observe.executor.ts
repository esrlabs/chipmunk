import { TExecutor, Logger, CancelablePromise, AsyncVoidExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';

export interface IFileOptionsDLT {}

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export interface IExecuteAssignOptions {
    filename: string;
    options: TFileOptions;
}

export const executor: TExecutor<void, IExecuteAssignOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteAssignOptions,
): CancelablePromise<void> => {
    return AsyncVoidExecutor<IExecuteAssignOptions>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: IExecuteAssignOptions,
            operationUuid: string,
        ): Promise<void> {
            return session.observe(options.filename, options.options, operationUuid);
        },
        'observe',
    );
};

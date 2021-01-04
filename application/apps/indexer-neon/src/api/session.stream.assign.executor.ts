import { TExecutor, Logger, CancelablePromise, noResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';

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
    return noResultsExecutor<IExecuteAssignOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExecuteAssignOptions): string | Error {
            const uuid: string | IGeneralError = session.assign(options.filename, options.options);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        "assign",
    );
};

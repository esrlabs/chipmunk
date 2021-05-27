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
        function(session: RustSession, options: IExecuteAssignOptions, operationUuid: string): Promise<void> {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const uuid: string | Error = session.assign(options.filename, options.options, operationUuid);
                    if (uuid instanceof Error) {
                        return reject(uuid);
                    } else if (typeof uuid !== 'string') {
                        return reject(new Error(`Unexpected format of output of "assign". Expecting {uuid}; get: ${uuid}`));
                    } else {
                        logger.debug(`Assign started. Operation UUID: ${uuid}`);
                        return resolve();
                    };
                });
            });
        },
        "assign",
    );
};

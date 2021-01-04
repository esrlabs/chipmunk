import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';

export interface IExtractOptions {

}

export interface IExtractDTFormatResult {
    format: string;
    reg: string;
}

export const executor: TExecutor<IExtractDTFormatResult, IExtractOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExtractOptions,
): CancelablePromise<IExtractDTFormatResult> => {
    return withResultsExecutor<IExtractDTFormatResult, IExtractOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IExtractOptions): string | Error {
            const uuid: string | IGeneralError = session.extract(options);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        function(result: any, resolve: (res: IExtractDTFormatResult) => void, reject: (err: Error) => void) {
            // TODO: implement result checks/convert
            resolve({
                format: '',
                reg: '',
            })
        },
        "extract",
    );
};

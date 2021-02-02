import { TExecutor, Logger, CancelablePromise, withResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { IGeneralError } from '../interfaces/errors';

export interface IDetectOptions {

}

export interface IDetectDTFormatResult {
    format: string;
    reg: string;
}

export const executor: TExecutor<IDetectDTFormatResult, IDetectOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IDetectOptions,
): CancelablePromise<IDetectDTFormatResult> => {
    return withResultsExecutor<IDetectDTFormatResult, IDetectOptions>(
        session,
        provider,
        logger,
        options,
        function(session: RustSession, options: IDetectOptions): string | Error {
            const uuid: string | IGeneralError = session.detect(options);
            if (typeof uuid !== 'string') {
                return new Error(uuid.message);
            } else {
                return uuid;
            };
        },
        function(result: any, resolve: (res: IDetectDTFormatResult) => void, reject: (err: Error) => void) {
            // TODO: implement result checks/convert
            resolve({
                format: '',
                reg: '',
            })
        },
        "detect",
    );
};

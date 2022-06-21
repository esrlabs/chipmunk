import { TExecutor, Logger, CancelablePromise, ResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';

export interface IDetectOptions {}

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
    return ResultsExecutor<IDetectDTFormatResult, IDetectOptions>(
        session,
        provider,
        logger,
        options,
        function (session: RustSession, options: IDetectOptions): string | Error {
            return session.detect(options);
        },
        function (
            result: any,
            resolve: (res: IDetectDTFormatResult) => void,
            // reject: (err: Error) => void,
        ) {
            // TODO: implement result checks/convert
            resolve({
                format: '',
                reg: '',
            });
        },
        'detect',
    );
};

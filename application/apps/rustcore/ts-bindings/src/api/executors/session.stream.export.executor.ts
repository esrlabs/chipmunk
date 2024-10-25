import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { IRange } from 'platform/types/range';
import { TextExportOptions } from 'platform/types/exporting';

export interface Options {
    dest: string;
    ranges: IRange[];
    opt: TextExportOptions;
}

export const executor: TExecutor<boolean, Options> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    opt: Options,
): CancelablePromise<boolean> => {
    return AsyncResultsExecutor<boolean, Options>(
        session,
        provider,
        logger,
        opt,
        function (session: RustSession, opt: Options, operationUuid: string): Promise<void> {
            return session.export(opt.dest, opt.ranges, opt.opt, operationUuid);
        },
        function (data: any, resolve: (done: boolean) => void, reject: (err: Error) => void) {
            data = data === 'true' ? true : data === 'false' ? false : data;
            if (typeof data !== 'boolean') {
                return reject(
                    new Error(
                        `Fail to parse export results. Invalid format. Expecting valid { boolean }; gotten: ${typeof data}`,
                    ),
                );
            }
            resolve(data);
        },
        'exporting',
    );
};

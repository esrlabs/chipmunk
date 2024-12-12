import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../session.provider';
import { IRange } from 'platform/types/range';

import * as protocol from 'protocol';

export interface Options {
    dest: string;
    ranges: IRange[];
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
            return session.exportRaw(opt.dest, opt.ranges, operationUuid);
        },
        function (
            data: Uint8Array,
            resolve: (done: boolean) => void,
            reject: (err: Error) => void,
        ) {
            const result = protocol.decodeResultBool(data);
            if (typeof result !== 'boolean') {
                return reject(
                    new Error(
                        `Fail to parse export results. Invalid format. Expecting valid { boolean }; gotten: ${typeof data}`,
                    ),
                );
            }
            resolve(result);
        },
        'exporting',
    );
};

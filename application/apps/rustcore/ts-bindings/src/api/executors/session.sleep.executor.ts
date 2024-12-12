import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';

import * as protocol from 'protocol';

export interface IExecuteSleepOptions {
    duration: number;
    ignoreCancellation: boolean;
}
export interface ISleepResults {
    sleep_well: boolean;
}

export const executor: TExecutor<ISleepResults, IExecuteSleepOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteSleepOptions,
): CancelablePromise<ISleepResults> => {
    return AsyncResultsExecutor<ISleepResults, IExecuteSleepOptions>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: IExecuteSleepOptions,
            operationUuid: string,
        ): Promise<void> {
            return session.sleep(operationUuid, options.duration, options.ignoreCancellation);
        },
        function (
            data: Uint8Array,
            resolve: (res: ISleepResults) => void,
            reject: (err: Error) => void,
        ) {
            try {
                const result: ISleepResults = protocol.decodeSleepResult(data);
                resolve(result);
            } catch (e) {
                return reject(
                    new Error(
                        `Fail to parse sleep results. Error: ${e instanceof Error ? e.message : e}`,
                    ),
                );
            }
        },
        'sleep',
    );
};

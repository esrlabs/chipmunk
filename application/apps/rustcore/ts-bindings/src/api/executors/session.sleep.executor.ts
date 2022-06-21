import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';

export interface IExecuteSleepOptions {
    duration: number;
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
            return session.sleep(operationUuid, options.duration);
        },
        function (data: any, resolve: (res: ISleepResults) => void, reject: (err: Error) => void) {
            try {
                const result: ISleepResults = JSON.parse(data);
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

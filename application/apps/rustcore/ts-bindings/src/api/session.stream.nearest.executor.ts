import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../native/index';
import { EventProvider } from './session.provider';
import { INearest } from '../interfaces';

export interface IExecuteNearestOptions {
    positionInStream: number;
}

export const executor: TExecutor<INearest, IExecuteNearestOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteNearestOptions,
): CancelablePromise<INearest> => {
    return AsyncResultsExecutor<INearest, IExecuteNearestOptions>(
        session,
        provider,
        logger,
        options,
        function (
            session: RustSession,
            options: IExecuteNearestOptions,
            operationUuid: string,
        ): Promise<any> {
            return session.getNearestTo(operationUuid, options.positionInStream);
        },
        function (data: any, resolve: (res: INearest) => void, reject: (err: Error) => void) {
            try {
                const result: INearest = JSON.parse(data);
                resolve(result);
            } catch (e) {
                return reject(
                    new Error(
                        `Fail to parse getNearestTo results. Error: ${
                            e instanceof Error ? e.message : e
                        }`,
                    ),
                );
            }
        },
        'getNearestTo',
    );
};

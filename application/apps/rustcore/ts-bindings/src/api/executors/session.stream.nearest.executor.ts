import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { INearest } from '../../interfaces/index';

export interface IExecuteNearestOptions {
    positionInStream: number;
}

export const executor: TExecutor<INearest | undefined, IExecuteNearestOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteNearestOptions,
): CancelablePromise<INearest | undefined> => {
    return AsyncResultsExecutor<INearest | undefined, IExecuteNearestOptions>(
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
        function (
            data: any,
            resolve: (res: INearest | undefined) => void,
            reject: (err: Error) => void,
        ) {
            try {
                const result: INearest | undefined | null = JSON.parse(data);
                resolve(result === null ? undefined : result);
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

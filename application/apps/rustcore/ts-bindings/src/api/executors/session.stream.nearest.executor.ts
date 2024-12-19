import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { NearestPosition, ResultNearestPosition } from 'platform/types/bindings';

import * as protocol from 'protocol';

export interface IExecuteNearestOptions {
    positionInStream: number;
}

export const executor: TExecutor<NearestPosition | undefined, IExecuteNearestOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExecuteNearestOptions,
): CancelablePromise<NearestPosition | undefined> => {
    return AsyncResultsExecutor<NearestPosition | undefined, IExecuteNearestOptions>(
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
            data: Uint8Array,
            resolve: (res: NearestPosition | undefined) => void,
            reject: (err: Error) => void,
        ) {
            try {
                const result: ResultNearestPosition = protocol.decodeResultNearestPosition(data);
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

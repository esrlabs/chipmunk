import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import { ISearchMap } from 'platform/types/filter';

import * as protocol from 'protocol';

export interface IOptions {
    datasetLength: number;
    from?: number;
    to?: number;
}

export const executor: TExecutor<ISearchMap, IOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IOptions,
): CancelablePromise<ISearchMap> => {
    return AsyncResultsExecutor<ISearchMap, IOptions>(
        session,
        provider,
        logger,
        options,
        function (session: RustSession, options: IOptions, operationUuid: string): Promise<void> {
            return new Promise((resolve, reject) => {
                if (options.from !== undefined && options.to !== undefined) {
                    if (
                        isNaN(options.from) ||
                        isNaN(options.to) ||
                        !isFinite(options.from) ||
                        !isFinite(options.to)
                    ) {
                        return reject(new Error(`Range is invalid`));
                    }
                    if (options.from > options.to) {
                        return reject(
                            new Error(`Range is invalid: "from" should not be less "to"`),
                        );
                    }
                }
                session
                    .getMap(operationUuid, options.datasetLength, options.from, options.to)
                    .catch(reject);
            });
        },
        function (
            data: Uint8Array,
            resolve: (res: ISearchMap) => void,
            reject: (err: Error) => void,
        ) {
            try {
                const result: ISearchMap = protocol.decodeResultScaledDistribution(data);
                if (!(result instanceof Array)) {
                    return reject(
                        new Error(
                            `Fail to parse search map. Invalid format. Expecting ISearchMap.`,
                        ),
                    );
                }
                resolve(result);
            } catch (err) {
                return reject(
                    new Error(
                        `Fail to parse search map. Error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            }
        },
        'get_map',
    );
};

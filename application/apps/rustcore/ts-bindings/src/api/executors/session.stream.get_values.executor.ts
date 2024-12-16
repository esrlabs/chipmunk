import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../session.provider';
import { IValuesMap } from 'platform/types/filter';
import { ResultSearchValues } from 'platform/types/bindings';
import { error } from 'platform/log/utils';

import * as protocol from 'protocol';

export interface IOptions {
    datasetLength: number;
    from?: number;
    to?: number;
}

export const executor: TExecutor<IValuesMap, IOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IOptions,
): CancelablePromise<IValuesMap> => {
    return AsyncResultsExecutor<IValuesMap, IOptions>(
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
                    .getValues(operationUuid, options.datasetLength, options.from, options.to)
                    .catch(reject);
            });
        },
        function (data: Uint8Array, resolve: (r: IValuesMap) => void, reject: (e: Error) => void) {
            try {
                const map: ResultSearchValues = protocol.decodeResultSearchValues(data);
                resolve(map);
            } catch (e) {
                reject(new Error(error(e)));
            }
        },
        'get_values',
    );
};

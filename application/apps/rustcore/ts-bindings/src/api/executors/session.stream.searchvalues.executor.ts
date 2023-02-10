import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../session.provider';
import { error } from 'platform/env/logger';

export type SearchValuesResult = Map<number, Map<number, string>>;
export type SearchValuesResultOrigin = { [key: string | number]: [number, string][] };

export const executor: TExecutor<SearchValuesResult, string[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: string[],
): CancelablePromise<SearchValuesResult> => {
    return AsyncResultsExecutor<SearchValuesResult, string[]>(
        session,
        provider,
        logger,
        filters,
        function (session: RustSession, filters: string[], operationUuid: string): Promise<void> {
            return session.searchValues(filters, operationUuid);
        },
        function (
            data: any,
            resolve: (values: SearchValuesResult) => void,
            reject: (err: Error) => void,
        ) {
            console.log(data);
            try {
                const parsed: SearchValuesResultOrigin = JSON.parse(data);
                if (typeof parsed !== 'object' || parsed === null || parsed === undefined) {
                    return reject(
                        new Error(`Invalid format of search values results. Data: ${data}`),
                    );
                }
                const results: SearchValuesResult = new Map();
                Object.keys(parsed).forEach((key: string) => {
                    const position = typeof key === 'number' ? key : parseInt(key, 10);
                    if (isNaN(position) || !isFinite(position)) {
                        throw new Error(`Fail to parse key: ${key}`);
                    }
                    const values = parsed[key];
                    if (!(values instanceof Array)) {
                        throw new Error(`Invalid format of values on key`);
                    }
                    const matches: Map<number, string> = new Map();
                    values.forEach((v) => {
                        if (!(v instanceof Array) || v.length !== 2) {
                            throw new Error(`Invalid format of values inside key`);
                        }
                        if (typeof v[0] !== 'number' || isNaN(v[0]) || !isFinite(v[0])) {
                            throw new Error(`Invalid key of filter: ${v[0]}`);
                        }
                        matches.set(v[0], v[1]);
                    });
                    results.set(position, matches);
                });
                resolve(results);
            } catch (e) {
                return reject(
                    new Error(`Fail to parse search values results: ${error(e)}\nData: ${data}`),
                );
            }

            // const found = parseInt(data, 10);
            // if (typeof found !== 'number' || isNaN(found) || !isFinite(found)) {
            //     return reject(
            //         new Error(
            //             `Fail to parse search results. Invalid format. Expecting valid { number }.`,
            //         ),
            //     );
            // }
        },
        'search',
    );
};

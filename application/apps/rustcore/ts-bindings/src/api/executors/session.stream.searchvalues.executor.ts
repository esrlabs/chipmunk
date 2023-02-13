import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../session.provider';
import { error } from 'platform/env/logger';
import { SearchValuesResult, SearchValuesResultOrigin } from 'platform/types/filter';

export { SearchValuesResult, SearchValuesResultOrigin };

export function parseOriginValues(data: string): SearchValuesResult | Error {
    const results: SearchValuesResult = new Map();
    try {
        const parsed: SearchValuesResultOrigin = JSON.parse(data);
        if (typeof parsed !== 'object' || parsed === null || parsed === undefined) {
            return new Error(`Invalid format of search values results. Data: ${data}`);
        }
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
    } catch (e) {
        return new Error(error(e));
    }
    return results;
}
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
            const results: SearchValuesResult | Error = parseOriginValues(data);
            if (results instanceof Error) {
                reject(results);
            } else {
                resolve(results);
            }
        },
        'search',
    );
};

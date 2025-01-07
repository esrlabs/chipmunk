import { TExecutor, Logger, CancelablePromise, AsyncResultsExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';
import {
    IFilter,
    TExtractedValuesSrc,
    IExtractedValueSrc,
    TExtractedValues,
    IExtractedMatch,
    IExtractedValue,
} from 'platform/types/filter';

import * as protocol from 'protocol';

export const executor: TExecutor<TExtractedValues, IFilter[]> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    filters: IFilter[],
): CancelablePromise<TExtractedValues> => {
    return AsyncResultsExecutor<TExtractedValues, IFilter[]>(
        session,
        provider,
        logger,
        filters,
        function (session: RustSession, filters: IFilter[], operationUuid: string): Promise<void> {
            return session.extractMatchesValues(filters, operationUuid);
        },
        function (
            data: Uint8Array,
            resolve: (res: TExtractedValues) => void,
            reject: (err: Error) => void,
        ) {
            try {
                const src: TExtractedValuesSrc = protocol.decodeResultExtractedMatchValues(data);
                if (!(src instanceof Array)) {
                    return reject(
                        new Error(
                            `Fail to parse extracting results. Invalid format. Expecting TExtractedValuesSrc (Array), but has been gotten: ${typeof src}`,
                        ),
                    );
                }
                const results: TExtractedValues = src.map((value: IExtractedValueSrc) => {
                    if (typeof value !== 'object' || value === null) {
                        throw new Error(
                            `Invalid format of {value: IExtractedValueSrc}: ${typeof value}.`,
                        );
                    }
                    if (typeof value.index !== 'number') {
                        throw new Error(
                            `Expecting value.index will be {number}, but it's: ${typeof value.index}`,
                        );
                    }
                    if (!(value.values instanceof Array)) {
                        throw new Error(
                            `Expecting value.values will be an Array, but it's: ${typeof value.values}`,
                        );
                    }
                    return {
                        position: value.index,
                        values: value.values.map((values: Array<number | string[]>) => {
                            if (values.length !== 2) {
                                throw new Error(
                                    `Expecting nested array in IExtractedValueSrc.values always will have len 2. But len is: ${values.length}`,
                                );
                            }
                            if (typeof values[0] !== 'number') {
                                throw new Error(
                                    `Expecting IExtractedValueSrc.values[0] will be {number} (index of filter). But it's: ${typeof values[0]} / ${
                                        values[0]
                                    }`,
                                );
                            }
                            if (!(values[1] instanceof Array)) {
                                throw new Error(
                                    `Expecting IExtractedValueSrc.values[1] will be {string[]} (values of matches). But it's: ${typeof values[1]} / ${
                                        values[1]
                                    }`,
                                );
                            }
                            return {
                                filter: filters[values[0] as number],
                                values: values[1] as string[],
                            } as IExtractedMatch;
                        }),
                    } as IExtractedValue;
                });
                resolve(results);
            } catch (err) {
                return reject(
                    new Error(
                        `Fail to parse extracting values results. Error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            }
        },
        'extract_matches_values',
    );
};

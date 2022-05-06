import * as Logs from '../util/logging';

import {
    IFilter,
    IGrabbedContent,
    IGrabbedElement,
    IExtractDTFormatResult,
    IExtractDTFormatOptions,
    IConcatFile,
    IFileMergeOptions,
    Observe,
} from '../interfaces/index';
import { getNativeModule } from './native';
import { error } from '../util/logging';
import { Types } from '../interfaces/dlt';

export { Types };

export function stats(filename: string): Promise<Types.StatisticInfo> {
    const DltRef = getNativeModule().Dlt;
    const dlt = new DltRef();
    return new Promise((resolve, reject) => {
        dlt.stats(filename)
            .then((stat: string) => {
                try {
                    resolve(JSON.parse(stat));
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            });
    });
}

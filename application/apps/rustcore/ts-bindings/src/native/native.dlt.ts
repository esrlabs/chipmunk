import { getNativeModule } from './native';
import { ICancelablePromise, CancelablePromise } from '../index';
import { error } from '../util/logging';
import { Types } from '../interfaces/dlt';
import { FtFile, FtOptions } from 'platform/types/parsers/dlt';

export { Types };

export function stats(files: string[]): Promise<Types.StatisticInfo> {
    const DltRef = getNativeModule().Dlt;
    const dlt = new DltRef();
    return new Promise((resolve, reject) => {
        dlt.stats(files)
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

/**
 * Scan a DLT trace for contained attachments.
 * @param input The DLT file to scan.
 * @param options The DLT filter and parsing options.
 * @returns A cancelable promise with the list of contained attachments.
 */
export function scanContainedFiles(input: string, options: FtOptions): ICancelablePromise<FtFile[]> {
    return new CancelablePromise((resolve, reject, _cancel, _refCancel, self) => {
        const DltRef = getNativeModule().Dlt;
        const dlt = new DltRef();
        let uuid: string | undefined;
        dlt.scanContainedFiles(input, options, (_uuid: string) => { uuid = _uuid; })
            .then((result: string) => {
                try {
                    resolve(JSON.parse(result));
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            })
            .finally(() => {
                uuid = undefined;
            });
        self.canceled(() => {
            if (uuid === undefined) {
                return;
            }
            const _uuid = uuid;
            uuid = undefined;
            dlt.cancelOperation(_uuid).catch((err: unknown) => {
                reject(new Error(error(err)));
            });
        });
    });
}

/**
 * Extract selected attachments from a DLT trace.
 * @param input The DLT file to extract from.
 * @param output The output folder to extract to.
 * @param files The selected attachments to extract.
 * @param options The DLT filter and parsing options.
 * @returns A cancelable promise with the number of bytes extracted.
 */
export function extractSelectedFiles(input: string, output: string, files: FtFile[], options: FtOptions): ICancelablePromise<number> {
    return new CancelablePromise((resolve, reject, _cancel, _refCancel, self) => {
        const DltRef = getNativeModule().Dlt;
        const dlt = new DltRef();
        let uuid: string | undefined;
        dlt.extractSelectedFiles(input, output, files, options, (_uuid: string) => { uuid = _uuid; })
            .then((result: string) => {
                try {
                    resolve(JSON.parse(result));
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            })
            .finally(() => {
                uuid = undefined;
            });
        self.canceled(() => {
            if (uuid === undefined) {
                return;
            }
            const _uuid = uuid;
            uuid = undefined;
            dlt.cancelOperation(_uuid).catch((err: unknown) => {
                reject(new Error(error(err)));
            });
        });
    });
}

/**
 * Extract all attachments from a DLT trace.
 * @param input The DLT file to extract from.
 * @param output The output folder to extract to.
 * @param options The DLT filter and parsing options.
 * @returns A cancelable promise with the number of bytes extracted.
 */
export function extractAllFiles(input: string, output: string, options: FtOptions): ICancelablePromise<number> {
    return new CancelablePromise((resolve, reject, _cancel, _refCancel, self) => {
        const DltRef = getNativeModule().Dlt;
        const dlt = new DltRef();
        let uuid: string | undefined;
        dlt.extractAllFiles(input, output, options, (_uuid: string) => { uuid = _uuid; })
            .then((result: string) => {
                try {
                    resolve(JSON.parse(result));
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            })
            .finally(() => {
                uuid = undefined;
            });
        self.canceled(() => {
            if (uuid === undefined) {
                return;
            }
            const _uuid = uuid;
            uuid = undefined;
            dlt.cancelOperation(_uuid).catch((err: unknown) => {
                reject(new Error(error(err)));
            });
        });
    });
}

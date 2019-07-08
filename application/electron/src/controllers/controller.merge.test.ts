// tslint:disable:max-classes-per-file
import * as fs from 'fs';
import ServiceStreams from '../services/service.streams';
import { Lvin, IDatetimeFormatTest, IDatetimeFormatTestResult } from 'logviewer.lvin';
import Logger from '../tools/env.logger';

export interface IFileTestResults {
    results: IDatetimeFormatTestResult;
    size: number;
}

export default class MergeTest {

    private _logger: Logger = new Logger('MergeTest');
    private _session: string = '';
    private _file: IDatetimeFormatTest;

    constructor(file: IDatetimeFormatTest, session?: string) {
        this._file = file;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
    }

    public test(): Promise<IFileTestResults> {
        return new Promise((resolve, reject) => {
            // Get common file size
            this._getSize(this._file.file).then((size: number) => {
                const sessionData = ServiceStreams.getStreamFile(this._session);
                if (sessionData instanceof Error) {
                    return reject(sessionData);
                }
                const lvin: Lvin = new Lvin();
                lvin.datetimeFormatTest(this._file).then((results: IDatetimeFormatTestResult) => {
                    resolve({
                        results: results,
                        size: size,
                    });
                }).catch((error: Error) => {
                    reject(error);
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public destroy() {
        // Nothing to do
    }

    private _getSize(file: string): Promise<number> {
        return new Promise((resolve, reject) => {
            fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (error !== null) {
                    return reject(error);
                }
                resolve(stats.size);
            });
        });
    }

}

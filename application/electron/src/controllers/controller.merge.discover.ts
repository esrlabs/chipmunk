// tslint:disable:max-classes-per-file
import ServiceStreams from '../services/service.streams';
import { Lvin, IDatetimeDiscoverResult } from 'logviewer.lvin';
import Logger from '../tools/env.logger';

export { IDatetimeDiscoverResult };

export default class MergeDiscover {

    private _logger: Logger = new Logger('MergeDiscover');
    private _session: string = '';
    private _files: string[];

    constructor(files: string[], session?: string) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
    }

    public discover(): Promise<IDatetimeDiscoverResult[]> {
        return new Promise((resolve, reject) => {
            const lvin: Lvin = new Lvin();
            lvin.datetimeDiscover(this._files).then((results: IDatetimeDiscoverResult[]) => {
                resolve(results);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public destroy() {
        // Nothing to do
    }

}

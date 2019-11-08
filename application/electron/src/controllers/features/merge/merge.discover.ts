// tslint:disable:max-classes-per-file
import ServiceStreams from '../../../services/service.streams';
import { Lvin, IDatetimeDiscoverResult, ILogMessage, IDatetimeDiscoverFileResult } from '../../external/controller.lvin';
import Logger from '../../../tools/env.logger';
import ServiceNotifications from '../../../services/service.notifications';

export { IDatetimeDiscoverResult };

export default class MergeDiscover {

    private _logger: Logger = new Logger('MergeDiscover');
    private _session: string = '';
    private _files: string[];

    constructor(files: string[], session?: string) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
    }

    public discover(): Promise<IDatetimeDiscoverFileResult[]> {
        return new Promise((resolve, reject) => {
            // Remember active session
            const session: string = ServiceStreams.getActiveStreamId();
            const lvin: Lvin = new Lvin();
            lvin.datetimeDiscover(this._files).then((results: IDatetimeDiscoverResult) => {
                if (results.logs instanceof Array) {
                    results.logs.forEach((log: ILogMessage) => {
                        ServiceNotifications.notify({
                            type: log.severity,
                            row: log.line_nr === null ? undefined : log.line_nr,
                            file: log.file_name,
                            message: log.text,
                            caption: log.file_name === undefined ? 'Mergin Error' : log.file_name,
                            session: session,
                        });
                    });
                }
                resolve(results.files);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public destroy() {
        // Nothing to do
    }

}

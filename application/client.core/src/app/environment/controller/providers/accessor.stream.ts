import { DataAccessor, IData } from './accessor';
import { CommonInterfaces } from '../../interfaces/interface.common';
import { IPCMessages as IPC } from '../../services/service.electron.ipc';

import ServiceElectronIpc from '../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export { IData } from './accessor';

export class StreamDataAccessor extends DataAccessor {

    private readonly _session: string;
    private readonly _logger: Toolkit.Logger;

    constructor(session: string) {
        super();
        this._session = session;
        this._logger = new Toolkit.Logger(`StreamDataAccessor: ${session}`);
    }

    public get(
        from: number,
        to: number
    ): Promise<IData> {
        return new Promise((resolve, reject) => {
            const loaded = this._logger.measure(`Loading chunk [${from} - ${to}]`);
            ServiceElectronIpc.request(
                new IPC.StreamChunk({
                    guid: this._session,
                    start: from,
                    end: to,
                }), IPC.StreamChunk
            ).then((response: IPC.StreamChunk) => {
                loaded();
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                if (typeof response.rows !== 'number') {
                    return reject(new Error(`Rows count isn't gotten.`));
                }
                const processed = this._logger.measure(`Processing chunk [${from} - ${to}]`);
                const rows = (() => {
                    try {
                        const parsed: CommonInterfaces.API.IGrabbedElement[] = JSON.parse(response.data);
                        if (!(parsed instanceof Array)) {
                            new Error(`Incorrect format of data. Expecting Array<IGrabbedElement>; gotten: ${typeof parsed}`);
                        }
                        return parsed;
                    } catch (e) {
                        return new Error(`Incorrect format of data: ${e.message}`);
                    }
                })();
                processed();
                if (rows instanceof Error) {
                    return reject(rows);
                }
                resolve({
                    rows: rows,
                    count: response.rows,
                    from,
                    to,
                });
            });
        });
    }

}

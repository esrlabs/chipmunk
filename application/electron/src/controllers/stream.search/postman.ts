import Logger from '../../tools/env.logger';
import ServiceElectron from '../../services/service.electron';
import BytesRowsMap from './file.map';

import { IPCMessages as IPC } from '../../services/service.electron';
import { IMapData } from './engine/controller';

const DELAY = {
    SearchUpdated: 250,     // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    SearchResultMap: 500,
};

export default class ControllerSearchUpdatesPostman {

    private _logger: Logger;
    private _streamId: string;
    private _notification: {
        SearchUpdated: { timer: any, last: number },
        SearchResultMap: { timer: any, last: number, data: IMapData, append: boolean },
    } = {
        SearchUpdated: { timer: -1, last: 0 },
        SearchResultMap: { timer: -1, last: 0, data: { stats: {}, map: {} }, append: false },
    };
    private _map: BytesRowsMap;
    private _destroyed: boolean = false;
    private _working: boolean = false;
    private _hasActiveRequests: () => boolean;

    constructor(streamId: string, map: BytesRowsMap, hasActiveRequests: () => boolean) {
        this._streamId = streamId;
        this._map = map;
        this._hasActiveRequests = hasActiveRequests;
        this._logger = new Logger(`ControllerSearchUpdatesPostman: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._notification.SearchUpdated.timer);
        clearTimeout(this._notification.SearchResultMap.timer);
        this._destroyed = true;
    }

    public notification(ignoreQueue: boolean = false): {
        SearchUpdated: () => void,
        SearchResultMap: (map: IMapData, append: boolean) => void,
    } {
        const self = this;
        function notify(target: 'SearchUpdated' | 'SearchResultMap') {
            clearTimeout(self._notification[target].timer);
            const past: number = Date.now() - self._notification[target].last;
            if (!self._working && (past >= DELAY[target] || ignoreQueue)) {
                self._notify()[target]();
                return;
            }
            const delay = past > DELAY[target] ? 0 : (DELAY[target] - past);
            self._notification[target].timer = setTimeout(() => {
                self._notify()[target]();
            }, delay);
        }
        return {
            SearchUpdated: () => {
                if (self._destroyed) {
                    self._logger.warn(`Attempt to notify after postman was destroyed.`);
                    return;
                }
                notify('SearchUpdated');
            },
            SearchResultMap: (data: IMapData, append: boolean) => {
                if (self._destroyed) {
                    self._logger.warn(`Attempt to notify after postman was destroyed.`);
                    return;
                }
                if (append) {
                    const ref = self._notification.SearchResultMap.data;
                    Object.keys(data.map).forEach((key: string) => {
                        if ((ref.map as any)[key] === undefined) {
                            (ref.map as any)[key] = (data.map as any)[key];
                        } else {
                            (ref.map as any)[key] = (ref.map as any)[key].concat((data.map as any)[key]);
                        }
                    });
                    Object.keys(data.stats).forEach((key: string) => {
                        if ((ref.stats as any)[key] === undefined) {
                            (ref.stats as any)[key] = (data.stats as any)[key];
                        } else {
                            (ref.stats as any)[key] += (data.stats as any)[key];
                        }
                    });
                } else {
                    self._notification.SearchResultMap.data = data;
                }
                self._notification.SearchResultMap.append = append;
                notify('SearchResultMap');
            },
        };
    }

    public drop() {
        clearTimeout(this._notification.SearchUpdated.timer);
        clearTimeout(this._notification.SearchResultMap.timer);
    }

    private _notify(): {
        SearchUpdated: () => void,
        SearchResultMap: () => void,
    } {
        const self = this;
        return {
            SearchUpdated: () => {
                self._notification.SearchUpdated.last = Date.now();
                if (!self._hasActiveRequests()) {
                    return;
                }
                self._working = true;
                ServiceElectron.IPC.send(new IPC.SearchUpdated({
                    guid: self._streamId,
                    length: self._map.getByteLength(),
                    rowsCount: self._map.getRowsCount(),
                })).then(() => {
                    self._working = false;
                }).catch((error: Error) => {
                    self._logger.warn(`Fail send notification to render due error: ${error.message}`);
                });
            },
            SearchResultMap: () => {
                self._notification.SearchResultMap.last = Date.now();
                if (!self._hasActiveRequests()) {
                    return;
                }
                self._working = true;
                ServiceElectron.IPC.send(new IPC.SearchResultMap({
                    streamId: self._streamId,
                    append: self._notification.SearchResultMap.append,
                    map: self._notification.SearchResultMap.data.map,
                    stats: self._notification.SearchResultMap.data.stats,
                })).catch((error: Error) => {
                    self._logger.warn(`Fail send notification to render due error: ${error.message}`);
                });
            },
        };
    }

}

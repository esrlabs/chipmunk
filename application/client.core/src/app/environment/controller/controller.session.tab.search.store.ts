import { Observable, Subject, Subscription } from 'rxjs';
import { FiltersStorage, FilterRequest } from './controller.session.tab.search.filters.storage';
import { ChartsStorage, ChartRequest } from './controller.session.tab.search.charts.storage';
import { RangesStorage, RangeRequest } from './controller.session.tab.search.ranges.storage';
import { DisabledRequest, DisabledStorage } from './controller.session.tab.search.disabled.storage';
import { IStore, EStoreKeys, IStoreData } from './controller.session.tab.search.store.support';

import ElectronIpcService, { IPCMessages } from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerSessionTabSearchStore {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };
    private _subjects: {
        filename: Subject<string>,
    } = {
        filename: new Subject<string>(),
    };
    private _filename: string = '';
    private _filters: FiltersStorage;
    private _charts: ChartsStorage;
    private _ranges: RangesStorage;
    private _disabled: DisabledStorage;
    private _loading: boolean = false;

    constructor(
        guid: string,
        filters: FiltersStorage,
        charts: ChartsStorage,
        ranges: RangesStorage,
        disabled: DisabledStorage,
    ) {
        this._guid = guid;
        this._filters = filters;
        this._charts = charts;
        this._ranges = ranges;
        this._disabled = disabled;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchStore: ${guid}`);
        [filters, charts, ranges, disabled].forEach((storage: FiltersStorage | ChartsStorage | RangesStorage | DisabledStorage, i: number) => {
            if ((storage.getObservable() as any).updated !== undefined) {
                this._subscriptions[Toolkit.guid()] = (storage.getObservable() as any).updated.subscribe(this._onChanges.bind(this));
            }
            if ((storage.getObservable() as any).changed !== undefined) {
                this._subscriptions[Toolkit.guid()] = (storage.getObservable() as any).changed.subscribe(this._onChanges.bind(this));
            }
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getObservable(): {
        filename: Observable<string>,
    } {
        return {
            filename: this._subjects.filename.asObservable(),
        };
    }

    public getCurrentFile(): string {
        return this._filename;
    }

    public load(file?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this._loading = true;
            ElectronIpcService.request(new IPCMessages.FiltersLoadRequest({
                file: file,
            }), IPCMessages.FiltersLoadResponse).then((response: IPCMessages.FiltersLoadResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                let store: IStoreData = {};
                try {
                    store = JSON.parse(response.store);
                } catch (e) {
                    this._logger.error(`Fail parse filters due error: ${e.message}`);
                    return;
                }
                [this._filters, this._charts, this._ranges, this._disabled].forEach((storage: IStore<any>) => {
                    if (typeof store[storage.store().key()] !== 'object' || store[storage.store().key()] === null) {
                        return;
                    }
                    storage.store().upload(store[storage.store().key()]);
                });
                this.setCurrentFile(response.file);
                this._loading = false;
                resolve(response.file);
            }).catch((error: Error) => {
                this._logger.error(`Fail to load filters due error: ${error.message}`);
                this._loading = false;
                reject(error);
            });
        });
    }

    public save(filename: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const store: IStoreData = {};
            let count: number = 0;
            [this._filters, this._charts, this._ranges, this._disabled].forEach((storage: IStore<any>) => {
                store[storage.store().key()] = storage.store().extract();
                count += storage.store().getItemsCount();
            });
            ElectronIpcService.request(new IPCMessages.FiltersSaveRequest({
                store: JSON.stringify(store),
                count: count,
                file: typeof filename === 'string' ? filename : undefined,
            }), IPCMessages.FiltersSaveResponse).then((response: IPCMessages.FiltersSaveResponse) => {
                if (response.error !== undefined) {
                    return new Error(response.error);
                }
                this.setCurrentFile(response.filename);
                resolve(response.filename);
            }).catch((error: Error) => {
                this._logger.error(`Fail to save filters due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FiltersFilesRecentResetRequest(), IPCMessages.FiltersFilesRecentResetResponse).then((message: IPCMessages.FiltersFilesRecentResetResponse) => {
                if (message.error) {
                    this._logger.error(`Fail to reset recent files due error: ${message.error}`);
                    return reject(new Error(message.error));
                }
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to reset recent files due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public setCurrentFile(filename: string) {
        this._filename = filename;
        this._subjects.filename.next(filename);
    }

    private _onChanges() {
        if (this._loading) {
            return;
        }
        if (this.getCurrentFile().trim() === '') {
            return;
        }
        let count: number = 0;
        [this._filters, this._charts, this._ranges, this._disabled].forEach((storage: FiltersStorage | ChartsStorage | RangesStorage | DisabledStorage) => {
            count += storage.get().length;
        });
        if (count === 0) {
            return;
        }
        this.save(this.getCurrentFile());
    }

}

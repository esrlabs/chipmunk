import { Subscription } from 'rxjs';
import { FiltersStorage } from '../filters/controller.session.tab.search.filters.storage';
import { ChartsStorage } from '../charts/controller.session.tab.search.charts.storage';
import { RangesStorage } from '../timeranges/controller.session.tab.search.ranges.storage';
import { DisabledStorage } from '../disabled/controller.session.tab.search.disabled.storage';
import { IStore, IStoreData } from './controller.session.tab.search.store.support';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

import ElectronIpcService, { IPC } from '../../../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IFiltersLoad {
    contentJSON: string;
    file: string;
}

export class ControllerSessionTabSearchStore implements Dependency {
    private _logger: Toolkit.Logger;
    private _uuid: string;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _filename: string = '';
    private _filters!: FiltersStorage;
    private _charts!: ChartsStorage;
    private _ranges!: RangesStorage;
    private _disabled!: DisabledStorage;
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        this._uuid = uuid;
        this._accessor = {
            session,
            search,
        };
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchStore: ${uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._filters = this._accessor.search().getFiltersAPI().getStorage();
            this._charts = this._accessor.search().getChartsAPI().getStorage();
            this._ranges = this._accessor.search().getRangesAPI().getStorage();
            this._disabled = this._accessor.search().getDisabledAPI().getStorage();
            resolve();
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

    public getName(): string {
        return 'ControllerSessionTabSearchStore';
    }

    public getCurrentFile(): string {
        return this._filename;
    }

    public loadWithFilePicker(file?: string): Promise<IFiltersLoad> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.FiltersLoadResponse>(
                new IPC.FiltersLoadRequest({
                    file: file,
                }),
                IPC.FiltersLoadResponse,
            )
                .then((response: IPC.FiltersLoadResponse) => {
                    if (response.error !== undefined) {
                        return reject(new Error(response.error));
                    }
                    if (response.store === undefined) {
                        return reject(
                            new Error(
                                this._logger.error(`FiltersLoadResponse returns invalid results`),
                            ),
                        );
                    }
                    resolve({ file: response.file, contentJSON: response.store });
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to load filters due error: ${error.message}`);
                    reject(error);
                });
        });
    }

    public load(filename: string, contentJSON: string, append: boolean) {
        let store: IStoreData = {};
        try {
            store = JSON.parse(contentJSON);
        } catch (err) {
            this._logger.error(
                `Fail parse filters due error: ${err instanceof Error ? err.message : err}`,
            );
            return;
        }
        [this._filters, this._charts, this._ranges, this._disabled].forEach(
            (storage: IStore<any>) => {
                if (
                    typeof store[storage.store().key()] !== 'object' ||
                    store[storage.store().key()] === null
                ) {
                    return;
                }
                storage.store().upload(store[storage.store().key()], append);
            },
        );
        this._filename = filename;
    }

    public save(filename: string | undefined): Promise<string> {
        return new Promise((resolve, reject) => {
            const store: IStoreData = {};
            let count: number = 0;
            [this._filters, this._charts, this._ranges, this._disabled].forEach(
                (storage: IStore<any>) => {
                    store[storage.store().key()] = storage.store().extract();
                    count += storage.store().getItemsCount();
                },
            );
            ElectronIpcService.request<IPC.FiltersSaveResponse>(
                new IPC.FiltersSaveRequest({
                    store: JSON.stringify(store),
                    count: count,
                    file: typeof filename === 'string' ? filename : undefined,
                }),
                IPC.FiltersSaveResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        return reject(new Error(response.error));
                    }
                    this._filename = response.filename;
                    resolve(response.filename);
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to save filters due error: ${error.message}`);
                    reject(error);
                });
        });
    }

    public clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.FiltersFilesRecentResetResponse>(
                new IPC.FiltersFilesRecentResetRequest(),
                IPC.FiltersFilesRecentResetResponse,
            )
                .then((message) => {
                    if (message.error) {
                        this._logger.error(
                            `Fail to reset recent files due error: ${message.error}`,
                        );
                        return reject(new Error(message.error));
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to reset recent files due error: ${error.message}`);
                    reject(error);
                });
        });
    }

    public storedCount(): number {
        let count: number = 0;
        [this._filters, this._charts, this._ranges, this._disabled].forEach(
            (storage: FiltersStorage | ChartsStorage | RangesStorage | DisabledStorage) => {
                count += storage.getStoredCount();
            },
        );
        return count;
    }
}

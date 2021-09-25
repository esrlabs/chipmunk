import { Observable, Subject } from 'rxjs';
import { IService } from '../interfaces/interface.service';

import ServiceElectronIpc, { IPC, Subscription } from './service.electron.ipc';

export class FilterOpenerService implements IService {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _subjects = {
        openFilters: new Subject<string | undefined>(),
    };

    constructor() {}

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.FiltersOpen = ServiceElectronIpc.subscribe(
                IPC.FiltersOpen,
                this._onFiltersOpen.bind(this),
            );
            resolve();
        });
    }

    public getName(): string {
        return 'FilterOpenerService';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public getObservable(): {
        openFilters: Observable<string | undefined>;
    } {
        return {
            openFilters: this._subjects.openFilters.asObservable(),
        };
    }

    private _onFiltersOpen(request: IPC.IFiltersOpen) {
        this._subjects.openFilters.next(request.file);
    }
}

export default new FilterOpenerService();

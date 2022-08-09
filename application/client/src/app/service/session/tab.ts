import { TabsService, ITab } from '@elements/tabs/service';
import { unique } from '@platform/env/sequence';

export class TabControls {
    public readonly uuid: string;

    private readonly service: TabsService;
    private _storage: unknown;

    constructor(tab: ITab, service: TabsService) {
        if (tab.uuid === undefined) {
            tab.uuid = unique();
        }
        this.uuid = tab.uuid;
        this.service = service;
    }

    public close() {
        this.service.remove(this.uuid);
    }

    public setTitle(title: string) {
        this.service.setTitle(this.uuid, title);
    }

    public storage<T>(): {
        set(value: T): void;
        get(): T | undefined;
    } {
        return {
            set: (value: T): void => {
                this._storage = value;
            },
            get: (): T | undefined => {
                return this._storage as T;
            },
        };
    }
}

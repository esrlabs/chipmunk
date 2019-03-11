import { Observable, Subject } from 'rxjs';
import * as Tools from '../../tools/index';
import { TabsOptions, ITabsOptions } from './options';
import { IComponentDesc } from 'logviewer-client-containers';

export { IComponentDesc };

export interface ITab {
    guid?: string;
    name: string;
    active: boolean;
    content?: IComponentDesc;
}

export class TabsService {

    private _subjects = {
        new: new Subject<ITab>(),
        clear: new Subject<void>(),
        active: new Subject<ITab>(),
        options: new Subject<TabsOptions>(),
    };

    private _tabs: Map<string, ITab> = new Map();
    private _options: TabsOptions = new TabsOptions();
    private _minimized: boolean = false;

    constructor(params?: {
        tabs?: Map<string, ITab>,
        options?: TabsOptions
    }) {
        params = params ? params : {};
        if (params.tabs !== void 0) { this._tabs = params.tabs; }
        if (params.options !== void 0) { this._options = params.options; }
    }

    public getObservable(): {
        new: Observable<ITab>,
        clear: Observable<void>,
        active: Observable<ITab>,
        options: Observable<TabsOptions>,
    } {
        return {
            new: this._subjects.new.asObservable(),
            clear: this._subjects.clear.asObservable(),
            active: this._subjects.active.asObservable(),
            options: this._subjects.options.asObservable(),
        };
    }

    public setActive(guid: string) {
        const tab = this._tabs.get(guid);
        if (tab === undefined) {
            return;
        }
        tab.active = true;
        this._tabs.set(guid, tab);
        this._subjects.active.next(tab);
    }

    public add(tab: ITab) {
        tab = this._normalize(tab);
        if (tab === null) {
            return;
        }
        this._tabs.set(tab.guid, tab);
        this._subjects.new.next(tab);
        if (tab.active) {
            this.setActive(tab.guid);
        }
    }

    public getTabs(): Map<string, ITab> {
        return this._tabs;
    }

    public getOptions(): TabsOptions {
        return this._options;
    }

    public setOptions(options: TabsOptions): void {
        this._options = options;
        this._subjects.options.next(this._options);
    }

    public updateOptions(options: ITabsOptions): boolean {
        if (typeof options !== 'object' || options === null) {
            return false;
        }
        Object.keys(options).forEach((key: string) => {
            this._options[key] = options[key];
        });
        this._subjects.options.next(this._options);
        return true;
    }

    public getActiveTab(): ITab | undefined {
        let active: ITab | undefined;
        this._tabs.forEach((tab: ITab) => {
            if (active !== undefined) {
                return;
            }
            if (tab.active) {
                active = tab;
            }
        });
        return active;
    }

    public clear() {
        this._tabs.clear();
        this._subjects.clear.next();
    }

    private _normalize(tab: ITab): ITab {
        if (typeof tab !== 'object' || tab === null) {
            return null;
        }
        tab.guid = typeof tab.guid === 'string' ? (tab.guid.trim() !== '' ? tab.guid : Tools.guid()) : Tools.guid();
        return tab;
    }
}

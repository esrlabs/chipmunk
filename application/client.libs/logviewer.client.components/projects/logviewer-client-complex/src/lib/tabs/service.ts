import { Observable, Subject } from 'rxjs';
import * as Tools from '../../tools/index';
import { TabsOptions, ITabsOptions } from './options';
import { IComponentDesc } from 'logviewer-client-containers';
import { ControllerSessionsHistroy } from './controller.histroy';

export { IComponentDesc };

export interface ITab {
    guid?: string;
    name: string;
    active: boolean;
    closable?: boolean;
    content?: IComponentDesc;
    tabCaptionInjection?: IComponentDesc;
    unshift?: boolean;
}

export class TabsService {

    private _subjects: {
        new: Subject<ITab>,
        removed: Subject<string>,
        clear: Subject<void>,
        active: Subject<ITab>,
        updated: Subject<ITab>,
        options: Subject<TabsOptions>,
    } = {
        new: new Subject<ITab>(),
        removed: new Subject<string>(),
        clear: new Subject<void>(),
        active: new Subject<ITab>(),
        updated: new Subject<ITab>(),
        options: new Subject<TabsOptions>(),
    };

    private _observable: {
        new: Observable<ITab>,
        removed: Observable<string>,
        clear: Observable<void>,
        active: Observable<ITab>,
        updated: Observable<ITab>,
        options: Observable<TabsOptions>,
    } = {
        new: this._subjects.new.asObservable(),
        removed: this._subjects.removed.asObservable(),
        clear: this._subjects.clear.asObservable(),
        active: this._subjects.active.asObservable(),
        updated: this._subjects.updated.asObservable(),
        options: this._subjects.options.asObservable(),
    };

    private _tabs: Map<string, ITab> = new Map();
    private _options: TabsOptions = new TabsOptions();
    private _minimized: boolean = false;
    private _history: ControllerSessionsHistroy = new ControllerSessionsHistroy();

    constructor(params?: {
        tabs?: Map<string, ITab>,
        options?: TabsOptions
    }) {
        params = params ? params : {};
        if (params.tabs !== void 0) { this._tabs = params.tabs; }
        if (params.options !== void 0) { this._options = params.options; }
    }

    public destroy() {
        Object.keys(this._subjects).forEach((key: string) => {
            this._subjects[key].unsubscribe();
        });
    }

    public getObservable(): {
        new: Observable<ITab>,
        removed: Observable<string>,
        clear: Observable<void>,
        active: Observable<ITab>,
        updated: Observable<ITab>,
        options: Observable<TabsOptions>,
    } {
        return this._observable;
    }

    public setActive(guid: string) {
        const tab = this._tabs.get(guid);
        if (tab === undefined) {
            return;
        }
        tab.active = true;
        this._tabs.set(guid, tab);
        this._subjects.active.next(tab);
        this._history.add(guid);
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

    public unshift(tab: ITab) {
        tab = this._normalize(tab);
        if (tab === null) {
            return;
        }
        tab.unshift = true;
        const tabs: Map<string, ITab> = new Map();
        tabs.set(tab.guid, tab);
        this._tabs.forEach((t: ITab, k: string) => {
            tabs.set(k, t);
        });
        this._tabs = tabs;
        this._subjects.new.next(tab);
        if (tab.active) {
            this.setActive(tab.guid);
        }
    }

    public remove(guid: string): Error | undefined {
        const tab = this._tabs.get(guid);
        if (tab === undefined) {
            return new Error(`Tab "${guid}" isn't found.`);
        }
        if (tab.content !== undefined && tab.content.inputs !== undefined && tab.content.inputs.onBeforeTabRemove !== undefined) {
            (tab.content.inputs.onBeforeTabRemove as Subject<void>).next();
        }
        this._tabs.delete(guid);
        this._history.remove(guid);
        this._subjects.removed.next(guid);
        if (tab.active && this._tabs.size > 0) {
            const last: string = this._history.getLast();
            if (last === undefined) {
                this.setActive(this._tabs.values().next().value.guid);
            } else {
                this.setActive(last);
            }
        }
    }

    public has(guid: string): boolean {
        let result: boolean = false;
        this._tabs.forEach((tab) => {
            if (tab.guid === guid) {
                result = true;
            }
        });
        return result;
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

    public setTitle(guid: string, title: string): Error | undefined {
        const tab: ITab | undefined = this._tabs.get(guid);
        if (tab === undefined) {
            return new Error(`Fail to find tab "${guid}", tab doesn't exist.`);
        }
        tab.name = title;
        this._tabs.set(guid, tab);
        this._subjects.updated.next(tab);

    }

    private _normalize(tab: ITab): ITab {
        if (typeof tab !== 'object' || tab === null) {
            return null;
        }
        tab.guid = typeof tab.guid === 'string' ? (tab.guid.trim() !== '' ? tab.guid : Tools.guid()) : Tools.guid();
        tab.closable = typeof tab.closable === 'boolean' ? tab.closable : true;
        if (tab.content !== undefined) {
            if (typeof tab.content.inputs !== 'object' || tab.content.inputs === null) {
                tab.content.inputs = {};
            }
            if (tab.content.inputs.onBeforeTabRemove === undefined) {
                tab.content.inputs.onBeforeTabRemove = new Subject();
            }
        }
        return tab;
    }
}

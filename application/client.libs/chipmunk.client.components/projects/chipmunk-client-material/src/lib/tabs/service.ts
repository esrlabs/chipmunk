import { Observable, Subject } from 'rxjs';
import * as Tools from '../../tools/index';
import { TabsOptions, ITabsOptions } from './options';
import { IComponentDesc } from '../dynamic/component';
import { ControllerSessionsHistroy } from './controller.histroy';

export interface ITabSubjects {
    onTitleContextMenu: Subject<MouseEvent>;
    onBeforeTabRemove: Subject<void>;
}

export interface ITab {
    guid?: string;
    name: string;
    active: boolean;
    closable?: boolean;
    content?: IComponentDesc;
    tabCaptionInjection?: IComponentDesc;
}

export interface ITabInternal {
    guid: string;
    name: string;
    active: boolean;
    closable: boolean;
    subjects: ITabSubjects;
    content?: IComponentDesc;
    tabCaptionInjection?: IComponentDesc;
    unshift: boolean;
}

export interface ITabAPI {
    tabCaptionInjection?: IComponentDesc;
    subjects: ITabSubjects;
    getGUID: () => string;
    close: () => void;
}

export class TabsService {

    private _subjects: {
        new: Subject<ITabInternal>,
        removed: Subject<string>,
        clear: Subject<void>,
        active: Subject<ITabInternal>,
        updated: Subject<ITabInternal>,
        options: Subject<TabsOptions>,
    } = {
        new: new Subject<ITabInternal>(),
        removed: new Subject<string>(),
        clear: new Subject<void>(),
        active: new Subject<ITabInternal>(),
        updated: new Subject<ITabInternal>(),
        options: new Subject<TabsOptions>(),
    };

    private _observable: {
        new: Observable<ITabInternal>,
        removed: Observable<string>,
        clear: Observable<void>,
        active: Observable<ITabInternal>,
        updated: Observable<ITabInternal>,
        options: Observable<TabsOptions>,
    } = {
        new: this._subjects.new.asObservable(),
        removed: this._subjects.removed.asObservable(),
        clear: this._subjects.clear.asObservable(),
        active: this._subjects.active.asObservable(),
        updated: this._subjects.updated.asObservable(),
        options: this._subjects.options.asObservable(),
    };

    private _tabs: Map<string, ITabInternal> = new Map();
    private _options: TabsOptions = new TabsOptions();
    private _history: ControllerSessionsHistroy = new ControllerSessionsHistroy();
    private _guid: string = Tools.guid();

    constructor(params?: {
        tabs?: Map<string, ITabInternal>,
        options?: TabsOptions,
        guid?: string,
    }) {
        params = params ? params : {};
        if (params.tabs !== void 0) { this._tabs = params.tabs; }
        if (params.options !== void 0) { this._options = params.options; }
        if (typeof params.guid === 'string' && params.guid.trim() !== '') { this._guid = params.guid; }
    }

    public destroy() {
        // Looks like unsubscription from subject gives exeptions
        // unsubscribing should be done from observable
        /*
        Object.keys(this._subjects).forEach((key: string) => {
            this._subjects[key].unsubscribe();
        });
        */
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        new: Observable<ITabInternal>,
        removed: Observable<string>,
        clear: Observable<void>,
        active: Observable<ITabInternal>,
        updated: Observable<ITabInternal>,
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

    public next() {
        const guids: string[] = Array.from(this._tabs.keys());
        if (guids.length === 0) {
            return;
        }
        const active = this.getActiveTab();
        let curr: number = -1;
        if (active !== undefined) {
            curr = guids.findIndex(t => t === active.guid);
        }
        if (curr + 1 > guids.length - 1) {
            curr = -1;
        }
        this.setActive(guids[curr + 1]);
    }

    public prev() {
        const guids: string[] = Array.from(this._tabs.keys());
        if (guids.length === 0) {
            return;
        }
        const active = this.getActiveTab();
        let curr: number = guids.length;
        if (active !== undefined) {
            curr = guids.findIndex(t => t === active.guid);
        }
        if (curr - 1 < 0) {
            curr = guids.length;
        }
        this.setActive(guids[curr - 1]);
    }

    public add(tab: ITab): ITabAPI | undefined {
        const _tab = this._normalize(tab);
        if (_tab === null) {
            return;
        }
        this._tabs.set(_tab.guid, _tab);
        this._subjects.new.next(_tab);
        if (_tab.active) {
            this.setActive(_tab.guid);
        }
        return {
            tabCaptionInjection: _tab.tabCaptionInjection,
            subjects: _tab.subjects,
            getGUID: () => _tab.guid,
            close: this.remove.bind(this, _tab.guid),
        };
    }

    public unshift(tab: ITab) {
        const _tab = this._normalize(tab);
        if (_tab === null) {
            return;
        }
        _tab.unshift = true;
        const tabs: Map<string, ITabInternal> = new Map();
        tabs.set(_tab.guid, _tab);
        this._tabs.forEach((t: ITabInternal, k: string) => {
            tabs.set(k, t);
        });
        this._tabs = tabs;
        this._subjects.new.next(_tab);
        if (_tab.active) {
            this.setActive(_tab.guid);
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

    public getTabs(): Map<string, ITabInternal> {
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

    public getActiveTab(): ITabInternal | undefined {
        let active: ITabInternal | undefined;
        this._tabs.forEach((tab: ITabInternal) => {
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
        const tab: ITabInternal | undefined = this._tabs.get(guid);
        if (tab === undefined) {
            return new Error(`Fail to find tab "${guid}", tab doesn't exist.`);
        }
        tab.name = title;
        this._tabs.set(guid, tab);
        this._subjects.updated.next(tab);

    }

    public getServiceGuid(): string {
        return this._guid;
    }

    private _normalize(tab: ITab): ITabInternal | null {
        if (typeof tab !== 'object' || tab === null) {
            return null;
        }
        const _tab: ITabInternal = tab as ITabInternal;
        _tab.guid = typeof _tab.guid === 'string' ? (_tab.guid.trim() !== '' ? _tab.guid : Tools.guid()) : Tools.guid();
        _tab.closable = typeof _tab.closable === 'boolean' ? _tab.closable : true;
        _tab.unshift = false;
        _tab.subjects = {
            onTitleContextMenu: new Subject<MouseEvent>(),
            onBeforeTabRemove: new Subject<void>(),
        };
        if (_tab.content !== undefined) {
            if (typeof _tab.content.inputs !== 'object' || _tab.content.inputs === null) {
                _tab.content.inputs = {};
            }
            _tab.content.inputs.onBeforeTabRemove = _tab.subjects.onBeforeTabRemove;
            _tab.content.inputs.onTitleContextMenu = _tab.subjects.onTitleContextMenu.asObservable();
        }
        return _tab;
    }
}

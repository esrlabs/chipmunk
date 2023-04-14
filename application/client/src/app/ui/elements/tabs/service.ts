import { Observable, Subject } from 'rxjs';
import { TabsOptions, ITabsOptions } from './options';
import { IComponentDesc } from '../containers/dynamic/component';
import { ControllerSessionsHistroy } from './controller.histroy';
import { unique } from '@platform/env/sequence';
import { setProp, getProp } from '@platform/env/obj';

export { ETabsListDirection, TabsOptions } from './options';

export interface ITabSubjects {
    onTitleContextMenu: Subject<MouseEvent>;
    onBeforeTabRemove: Subject<void>;
}

export interface ITab {
    uuid?: string;
    icon?: string;
    uppercaseTitle?: boolean;
    name: string;
    active: boolean;
    closable?: boolean;
    content?: IComponentDesc;
    tabCaptionInjection?: IComponentDesc;
}

export interface ITabInternal {
    uuid: string;
    name: string;
    uppercaseTitle: boolean;
    icon?: string;
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
    setTitle: (caption: string) => Error | undefined;
    getTitle: () => Error | string;
}

export class TabsService {
    private _subjects: {
        new: Subject<ITabInternal>;
        removed: Subject<string>;
        clear: Subject<void>;
        active: Subject<ITabInternal>;
        updated: Subject<ITabInternal>;
        options: Subject<TabsOptions>;
    } = {
        new: new Subject<ITabInternal>(),
        removed: new Subject<string>(),
        clear: new Subject<void>(),
        active: new Subject<ITabInternal>(),
        updated: new Subject<ITabInternal>(),
        options: new Subject<TabsOptions>(),
    };

    private _observable: {
        new: Observable<ITabInternal>;
        removed: Observable<string>;
        clear: Observable<void>;
        active: Observable<ITabInternal>;
        updated: Observable<ITabInternal>;
        options: Observable<TabsOptions>;
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
    private _uuid: string = unique();

    constructor(params?: {
        tabs?: Map<string, ITabInternal>;
        options?: TabsOptions;
        uuid?: string;
    }) {
        params = params ? params : {};
        if (params.tabs !== void 0) {
            this._tabs = params.tabs;
        }
        if (params.options !== void 0) {
            this._options = params.options;
        }
        if (typeof params.uuid === 'string' && params.uuid.trim() !== '') {
            this._uuid = params.uuid;
        }
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

    public getUuid(): string {
        return this._uuid;
    }

    public getObservable(): {
        new: Observable<ITabInternal>;
        removed: Observable<string>;
        clear: Observable<void>;
        active: Observable<ITabInternal>;
        updated: Observable<ITabInternal>;
        options: Observable<TabsOptions>;
    } {
        return this._observable;
    }

    public setActive(uuid: string) {
        const tab = this._tabs.get(uuid);
        if (tab === undefined) {
            return;
        }
        tab.active = true;
        this._tabs.set(uuid, tab);
        this._subjects.active.next(tab);
        this._history.add(uuid);
    }

    public next() {
        const guids: string[] = Array.from(this._tabs.keys());
        if (guids.length === 0) {
            return;
        }
        const active = this.getActiveTab();
        let curr: number = -1;
        if (active !== undefined) {
            curr = guids.findIndex((t) => t === active.uuid);
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
            curr = guids.findIndex((t) => t === active.uuid);
        }
        if (curr - 1 < 0) {
            curr = guids.length;
        }
        this.setActive(guids[curr - 1]);
    }

    public add(tab: ITab): ITabAPI {
        const _tab = this._normalize(tab);
        if (_tab === null) {
            throw new Error(`Fail to create tab`);
        }
        this._tabs.set(_tab.uuid, _tab);
        this._subjects.new.next(_tab);
        if (_tab.active) {
            this.setActive(_tab.uuid);
        }
        return {
            tabCaptionInjection: _tab.tabCaptionInjection,
            subjects: _tab.subjects,
            getGUID: () => _tab.uuid,
            close: this.remove.bind(this, _tab.uuid),
            setTitle: this.setTitle.bind(this, _tab.uuid),
            getTitle: this.getTitle.bind(this, _tab.uuid),
        };
    }

    public unshift(tab: ITab) {
        const _tab = this._normalize(tab);
        if (_tab === null) {
            return;
        }
        _tab.unshift = true;
        const tabs: Map<string, ITabInternal> = new Map();
        tabs.set(_tab.uuid, _tab);
        this._tabs.forEach((t: ITabInternal, k: string) => {
            tabs.set(k, t);
        });
        this._tabs = tabs;
        this._subjects.new.next(_tab);
        if (_tab.active) {
            this.setActive(_tab.uuid);
        }
    }

    public remove(uuid: string): Error | undefined {
        const tab = this._tabs.get(uuid);
        if (tab === undefined) {
            return new Error(`Tab "${uuid}" isn't found.`);
        }
        if (
            tab.content !== undefined &&
            tab.content.inputs !== undefined &&
            tab.content.inputs.onBeforeTabRemove !== undefined
        ) {
            (tab.content.inputs.onBeforeTabRemove as Subject<void>).next();
        }
        this._tabs.delete(uuid);
        this._history.remove(uuid);
        this._subjects.removed.next(uuid);
        if (tab.active && this._tabs.size > 0) {
            const last: string | undefined = this._history.getLast();
            if (last === undefined) {
                this.setActive(this._tabs.values().next().value.uuid);
            } else {
                this.setActive(last);
            }
        }
        return undefined;
    }

    public has(uuid: string): boolean {
        let result: boolean = false;
        this._tabs.forEach((tab) => {
            if (tab.uuid === uuid) {
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
            setProp(this._options, key, getProp(options, key));
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

    public setTitle(uuid: string, title: string): Error | undefined {
        const tab: ITabInternal | undefined = this._tabs.get(uuid);
        if (tab === undefined) {
            return new Error(`Fail to find tab "${uuid}", tab doesn't exist.`);
        }
        tab.name = title;
        this._tabs.set(uuid, tab);
        this._subjects.updated.next(tab);
        return undefined;
    }

    public getTitle(uuid: string): Error | string {
        const tab: ITabInternal | undefined = this._tabs.get(uuid);
        if (tab === undefined) {
            return new Error(`Fail to find tab "${uuid}", tab doesn't exist.`);
        }
        return tab.name;
    }

    public getServiceGuid(): string {
        return this._uuid;
    }

    private _normalize(tab: ITab): ITabInternal | null {
        if (typeof tab !== 'object' || tab === null) {
            return null;
        }
        const _tab: ITabInternal = tab as ITabInternal;
        _tab.uuid =
            typeof _tab.uuid === 'string'
                ? _tab.uuid.trim() !== ''
                    ? _tab.uuid
                    : unique()
                : unique();
        _tab.closable = typeof _tab.closable === 'boolean' ? _tab.closable : true;
        _tab.unshift = false;
        _tab.uppercaseTitle = tab.uppercaseTitle === undefined ? false : tab.uppercaseTitle;
        _tab.subjects = {
            onTitleContextMenu: new Subject<MouseEvent>(),
            onBeforeTabRemove: new Subject<void>(),
        };
        if (_tab.content !== undefined) {
            if (typeof _tab.content.inputs !== 'object' || _tab.content.inputs === null) {
                _tab.content.inputs = {};
            }
            _tab.content.inputs.onBeforeTabRemove = _tab.subjects.onBeforeTabRemove;
            _tab.content.inputs.onTitleContextMenu =
                _tab.subjects.onTitleContextMenu.asObservable();
        }
        return _tab;
    }
}

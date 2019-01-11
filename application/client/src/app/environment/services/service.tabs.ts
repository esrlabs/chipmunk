import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DockDef } from './service.docks';
import * as Tools from '../tools/index';

export interface ITab {
    id?: string;
    name: string;
    active: boolean;
    dock: DockDef.IDock;
}

@Injectable({ providedIn: 'root' })

export class TabsService {

    private _subjectTab = new Subject<ITab>();
    private _subjectActive = new Subject<ITab>();
    private _tabs: Map<string, ITab> = new Map();

    setActive(id: string) {
        const tab = this._tabs.get(id);
        if (tab === undefined) {
            return;
        }
        tab.active = true;
        this._tabs.set(id, tab);
        this._subjectActive.next(tab);
    }

    getActiveObservable(): Observable<ITab> {
        return this._subjectActive.asObservable();
    }

    add(tab: ITab) {
        tab = this._normalize(tab);
        if (tab === null) {
            return;
        }
        this._tabs.set(tab.id, tab);
        this._subjectTab.next(tab);
        if (tab.active) {
            this.setActive(tab.id);
        }
    }

    clear() {
        this._tabs.clear();
        this._subjectTab.next();
    }

    getObservable(): Observable<ITab> {
        return this._subjectTab.asObservable();
    }

    private _normalize(tab: ITab): ITab {
        if (typeof tab !== 'object' || tab === null) {
            return null;
        }
        tab.id = typeof tab.id === 'string' ? (tab.id.trim() !== '' ? tab.id : Tools.guid()) : Tools.guid();
        return tab;
    }
}

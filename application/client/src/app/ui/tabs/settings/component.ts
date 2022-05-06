import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import {
    Entry as LocalEntry,
    ConnectedField,
    Field,
    LocalField,
} from '../../../controller/settings/field.store';
import { sortPairs, IPair } from '../../../thirdparty/code/engine';
import { ISettingsAPI, Entry } from 'chipmunk.client.toolkit';

import SettingsService from '../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

const CDelimiter = '\u0008';

@Component({
    selector: 'app-tabs-settings',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TabSettingsComponent implements OnDestroy, AfterContentInit {
    public _ng_entries: Map<string, LocalEntry | ConnectedField<any> | Field<any>> = new Map();
    public _ng_fields: Array<ConnectedField<any> | LocalField<any>> = [];
    public _ng_focused: LocalEntry | ConnectedField<any> | Field<any> | undefined;
    public _ng_focusedSubject: Subject<string> = new Subject();
    public _ng_filter: string = '';
    public _ng_matches: Map<string, IPair> = new Map();

    private _entries: Map<string, LocalEntry | ConnectedField<any> | Field<any>> = new Map();
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsComponent');

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_focusedSubject.asObservable().subscribe(this._onFocusChange.bind(this));
    }

    public ngAfterContentInit() {
        SettingsService.entries()
            .then((entries) => {
                this._entries = entries as Map<
                    string,
                    LocalEntry | ConnectedField<any> | Field<any>
                >;
                this._ng_entries = this._getEntries();
                this._ng_matches = this._getMatches();
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._logger.error(`Fail get settings data due error: ${error.message}`);
            });
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public _ng_onFilterChange(value: string) {
        this._ng_matches = this._getMatches();
        this._ng_fields = this._getFields();
        this._ng_entries = this._getEntries();
        this._updateFocused();
        this._forceUpdate();
    }

    private _updateFocused() {
        if (this._ng_focused === undefined && this._ng_filter === '') {
            return;
        }
        if (this._ng_matches.size === 0) {
            return;
        }
        const entry: LocalEntry | undefined = this._entries.get(
            Array.from(this._ng_matches.values())[0].id,
        );
        const parent: LocalEntry | undefined =
            entry === undefined ? undefined : this._entries.get(entry.getPath());
        if (parent !== undefined) {
            this._onFocusChange(parent.getFullPath(), true);
        } else if (this._ng_focused !== undefined) {
            this._onFocusChange(this._ng_focused.getFullPath(), true);
        }
    }

    private _getMatches(): Map<string, IPair> {
        const filtered: Map<string, IPair> = new Map();
        if (this._ng_filter === '') {
            this._entries.forEach((entry: LocalEntry | ConnectedField<any> | Field<any>) => {
                filtered.set(entry.getFullPath(), {
                    id: entry.getFullPath(),
                    caption: entry.getName(),
                    description: entry.getDesc(),
                });
            });
            return filtered;
        }
        const pairs: IPair[] = [];
        this._entries.forEach((entry: LocalEntry | ConnectedField<any> | Field<any>) => {
            pairs.push({
                id: entry.getFullPath(),
                caption: `${entry.getName()}${CDelimiter}${entry.getDesc()}`,
                description: '',
            });
        });
        const scored = sortPairs(pairs, this._ng_filter, true, 'span');
        scored.forEach((s: IPair) => {
            const pair = s.tcaption === undefined ? s.caption : s.tcaption.split(CDelimiter);
            filtered.set(s.id, {
                id: s.id,
                caption: pair[0],
                description: pair[1],
            });
        });
        return filtered;
    }

    private _getEntries(): Map<string, LocalEntry | ConnectedField<any> | Field<any>> {
        function hasMatches(matches: Map<string, IPair>, path: string): boolean {
            let included: boolean = false;
            matches.forEach((pair: IPair, key: string) => {
                if (included) {
                    return;
                }
                included = key.indexOf(path) === 0;
            });
            return included;
        }
        if (this._ng_filter === '') {
            return this._entries;
        }
        const entries: Map<string, LocalEntry | ConnectedField<any> | Field<any>> = new Map();
        this._entries.forEach((entry: LocalEntry | ConnectedField<any> | Field<any>) => {
            if (entry instanceof ConnectedField || entry instanceof Field) {
                return;
            } else if (hasMatches(this._ng_matches, entry.getFullPath())) {
                entries.set(entry.getFullPath(), entry);
            }
        });
        return entries;
    }

    private _getFields(): Array<ConnectedField<any> | LocalField<any>> {
        const focused = this._ng_focused;
        if (focused === undefined) {
            return [];
        }
        const fields: Array<ConnectedField<any> | LocalField<any>> = [];
        this._entries.forEach(
            (field: LocalEntry | ConnectedField<any> | Field<any>, key: string) => {
                if (
                    (!(field instanceof ConnectedField) && !(field instanceof Field)) ||
                    field.getPath() !== focused.getFullPath()
                ) {
                    return;
                }
                if (this._ng_filter === '' || this._ng_matches.has(field.getFullPath())) {
                    fields.push(field as LocalField<any>);
                }
            },
        );
        fields.sort((a, b) => {
            return a.getIndex() > b.getIndex() ? 1 : -1;
        });
        return fields;
    }

    private _onFocusChange(path: string, internal: boolean = false) {
        const entry: LocalEntry | ConnectedField<any> | Field<any> | undefined =
            this._entries.get(path);
        if (entry === undefined) {
            return;
        }
        if (
            this._ng_focused !== undefined &&
            this._ng_focused.getFullPath() === entry.getFullPath()
        ) {
            return;
        }
        this._ng_focused = entry;
        this._ng_fields = this._getFields();
        if (internal) {
            this._ng_focusedSubject.next(path);
        }
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

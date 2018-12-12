import * as IDlt from './dlt.interface';

import { events as Events                       } from '../../modules/controller.events';
import { configuration as Configuration         } from '../../modules/controller.config';
import { EventEmitter                           } from "@angular/core";

import Emitter from '../../modules/tools.emitter';

class DLTService extends Emitter {
    public EVENTS = {
        structure: Symbol(),
        entries: Symbol(),
    };

    private _entries: IDlt.IEntry[] = [];
    private _rows: string[] = [];
    private _entryNames: string[] = [];
    private _structure: IDlt.TStructure = new Map();
    private _description: IDlt.TStructureDescription = {
        apps: new Map(),
        contexts: new Map()
    };
    private _counter: { [key: string]: number } = {};

    constructor() {
        super();
    }

    public create(description: string, data: IDlt.TDecodeResult) {
        this._reset();
        this.addEntries(data);
        this._updateDescriptions(data.entries);
        this._updateStructure(data.entries);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, description);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, data.rows.join('\n'));
    }

    public addEntries(data: IDlt.TDecodeResult) {
        if (this._entryNames.length === 0) {
            this._entryNames = data.entryNames;
        }
        this._entries.push(...data.entries);
        this._rows.push(...data.rows);
        this.emit(this.EVENTS.entries, data.entries);
    }

    public getEntries(): IDlt.IEntry[] {
        return this._entries;
    }

    public getStructure(): IDlt.TStructure {
        return this._structure;
    }

    public getCount(edu: string, app: string = '', cntx: string = '') {
        let alias: string = `${edu}_${app}_${cntx}`;
        return this._counter[alias] === void 0 ? 0 : this._counter[alias];
    }

    private _reset() {
        this._entries = [];
        this._entryNames = [];
        this._rows = [];
        this._structure = new Map();
        this._description = {
            apps: new Map(),
            contexts: new Map()
        };
        this._counter = {};
    }

    private _updateDescriptions(entries: IDlt.IEntry[]) {
        entries.forEach((entry: IDlt.IEntry) => {
            if (entry.type !== IDlt.EType.log || entry.subtype !== IDlt.ESubtype.info) {
                return;
            }
            if (entry.payload.search('Description=') === -1) {
                return;
            }
            let description: any = entry.payload.match(/Description=.*/gi);
            if (description === null || description.length !== 1) {
                return;
            }
            description = description[0].replace(/Description=/gi, '');
            if (entry.payload.search('ContextID') !== -1) {
                let matches = entry.payload.match(/ContextID\s*'[\w\d]*'/g);
                if (matches === null || matches.length !== 1) {
                    return;
                }
                const contextId: string = matches[0].replace(/ContextID\s*'/g, '').replace(/[^\w\d]/gi, '');
                matches = entry.payload.match(/ApID\s*'[\w\d]*'/g);
                if (matches === null || matches.length !== 1) {
                    return;
                }
                const appId: string = matches[0].replace(/ApID\s*'/g, '').replace(/[^\w\d]/gi, '');
                let contexts = this._description.contexts.get(contextId);
                if (contexts === undefined) {
                    contexts = new Map();
                }
                let apps = contexts.get(appId);
                if (apps === undefined) {
                    contexts.set(appId, description);
                    this._description.contexts.set(contextId, contexts);
                }
                return;
            } else if (entry.payload.search('ApplicationID') !== -1) {
                let matches = entry.payload.match(/ApplicationID\s*'[\w\d]*'/g);
                if (matches === null || matches.length !== 1) {
                    return;
                }
                const appId: string = matches[0].replace(/ApplicationID\s*'/g, '').replace(/[^\w\d]/gi, '');
                if (this._description.apps.get(appId) === undefined) {
                    this._description.apps.set(appId, description);
                }
                return;
            }
        });
    }

    private _updateStructure(entries: IDlt.IEntry[]) {
        let updated: boolean = false;
        entries.forEach((entry: IDlt.IEntry) => {
            let edu: IDlt.TStructureEduEntry = this._structure.get(entry.ecuid);
            if (edu === undefined) {
                edu = {
                    setting: {
                        logLevel: IDlt.ELogLevel.inherit,
                        traceStatus: IDlt.ETraceStatus.inherit,
                        description: ''
                    },
                    map: new Map(),
                    id: entry.ecuid,
                    count: 0
                };
            }
            let app: IDlt.TStructureAppEntry = edu.map.get(entry.apid);
            if (app === undefined) {
                let description = this._description.apps.get(entry.apid);
                app = {
                    setting: {
                        logLevel: IDlt.ELogLevel.inherit,
                        traceStatus: IDlt.ETraceStatus.inherit,
                        description: description !== undefined ? description : ''
                    },
                    map: new Map(),
                    id: entry.apid,
                    count: 0
                };
            }
            let cont = app.map.get(entry.ctid);
            if (cont === undefined) {
                let description: any = this._description.contexts.get(entry.ctid);
                if (description !== undefined) {
                    description = description.get(entry.apid);
                }
                app.map.set(entry.ctid, {
                    setting: {
                        logLevel: IDlt.ELogLevel.inherit,
                        traceStatus: IDlt.ETraceStatus.inherit,
                        description: description !== undefined ? description : '',
                    },
                    id: entry.ctid,
                    count: 0
                });
                edu.map.set(entry.apid, app);
                this._structure.set(entry.ecuid, edu);
                updated = true;
            }
            this._increaseCounter(entry.ecuid, entry.apid, entry.ctid);
        });
        updated && this.emit(this.EVENTS.structure, this._structure);
    }

    private _increaseCounter(edu: string, app: string = '', cntx: string = '') {
        let alias: string = `${edu}_${app}_${cntx}`;
        if (this._counter[alias] === void 0) {
            this._counter[alias] = 0;
        }
        this._counter[alias] += 1;
        if (app !== '' && cntx !== '') {
            this._increaseCounter(edu);
            this._increaseCounter(edu, app);
        }
    }

}

export default (new DLTService());
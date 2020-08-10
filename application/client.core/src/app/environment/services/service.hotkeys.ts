declare var Electron: any;

import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import ElectronIpcService, { IPCMessages } from './service.electron.ipc';
import PopupsService from './standalone/service.popups';
import { DialogsHotkeysMapComponent } from '../components/dialogs/hotkeys/component';

export enum EHotkeyCategory {
    Files = 'Files',
    Focus = 'Focus',
    Tabs = 'Tabs',
    Movement = 'Movement',
    Areas = 'Areas',
    Other = 'Other'
}

export const CKeysMap = {
    [IPCMessages.EHotkeyActionRef.newTab]:                  { shortkeys: ['⌘ + T', 'Ctrl + T'],                         description: 'Open new tab',                    category: EHotkeyCategory.Tabs },
    [IPCMessages.EHotkeyActionRef.closeTab]:                { shortkeys: ['⌘ + W', 'Ctrl + W'],                         description: 'Close active tab',                category: EHotkeyCategory.Tabs },
    [IPCMessages.EHotkeyActionRef.nextTab]:                 { shortkeys: ['⌘ + Tab', 'Ctrl + Tab'],                     description: 'Next tab',                        category: EHotkeyCategory.Tabs },
    [IPCMessages.EHotkeyActionRef.prevTab]:                 { shortkeys: ['Shift + ⌘ + Tab', 'Shift + Ctrl + Tab'],     description: 'Previous tab',                    category: EHotkeyCategory.Tabs },
    [IPCMessages.EHotkeyActionRef.recentFiles]:             { shortkeys: ['⌘ + J', 'Ctrl + P'],                         description: 'Open recent files',               category: EHotkeyCategory.Files },
    [IPCMessages.EHotkeyActionRef.recentFilters]:           { shortkeys: ['Shift + ⌘ + J', 'Shift + Ctrl + P'],         description: 'Open recent filtres',             category: EHotkeyCategory.Files },
    [IPCMessages.EHotkeyActionRef.openLocalFile]:           { shortkeys: ['⌘ + O', 'Ctrl + O'],                         description: 'Open local file',                 category: EHotkeyCategory.Files },
    [IPCMessages.EHotkeyActionRef.openSearchFiltersTab]:    { shortkeys: ['Shift + ⌘ + F', 'Shift + Ctrl + F'],         description: 'Show filters tab',                category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.selectNextRow]:           { shortkeys: ['j'],                                          description: 'Select next bookmarked row',      category: EHotkeyCategory.Movement },
    [IPCMessages.EHotkeyActionRef.selectPrevRow]:           { shortkeys: ['k'],                                          description: 'Select previous bookmarked row',  category: EHotkeyCategory.Movement },
    [IPCMessages.EHotkeyActionRef.focusSearchInput]:        { shortkeys: ['⌘ + F', 'Ctrl + F', '/'],                    description: 'Focus on search input',           category: EHotkeyCategory.Focus },
    [IPCMessages.EHotkeyActionRef.focusMainView]:           { shortkeys: ['⌘ + 1', 'Ctrl + 1'],                         description: 'Focus on main output',            category: EHotkeyCategory.Focus },
    [IPCMessages.EHotkeyActionRef.focusSearchView]:         { shortkeys: ['⌘ + 2', 'Ctrl + 2'],                         description: 'Focus on search results output',  category: EHotkeyCategory.Focus },
    [IPCMessages.EHotkeyActionRef.sidebarToggle]:           { shortkeys: ['⌘ + B', 'Ctrl + B'],                         description: 'Toggle sidebar',                  category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.toolbarToggle]:           { shortkeys: ['⌘ + J', 'Ctrl + J'],                         description: 'Toggle toolbar',                  category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.settings]:                { shortkeys: ['⌘ + ,', 'Ctrl + ,'],                         description: 'Show settings',                   category: EHotkeyCategory.Other },
    [IPCMessages.EHotkeyActionRef.showHotkeysMapDialog]:    { shortkeys: ['?'],                                          description: 'Show this dialog',                category: EHotkeyCategory.Other },
};

const CLocalHotkeyMap = {
    [IPCMessages.EHotkeyActionRef.focusSearchInput]:        '/',
    [IPCMessages.EHotkeyActionRef.selectNextRow]:           'j',
    [IPCMessages.EHotkeyActionRef.selectPrevRow]:           'k',
    [IPCMessages.EHotkeyActionRef.showHotkeysMapDialog]:    '?',
};

export interface IHotkeyEvent {
    unixtime: number;
    session: string;
}

export class HotkeysService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('HotkeysService');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _dialogGuid: string = Toolkit.guid();
    private _paused: boolean = false;
    private _input: boolean = false;
    private _localKeys: string[] = [];

    private _subjects = {
        newTab: new Subject<IHotkeyEvent>(),
        closeTab: new Subject<IHotkeyEvent>(),
        openLocalFile: new Subject<IHotkeyEvent>(),
        focusSearchInput: new Subject<IHotkeyEvent>(),
        openSearchFiltersTab: new Subject<IHotkeyEvent>(),
        selectNextRow: new Subject<IHotkeyEvent>(),
        selectPrevRow: new Subject<IHotkeyEvent>(),
        focusMainView: new Subject<IHotkeyEvent>(),
        focusSearchView: new Subject<IHotkeyEvent>(),
        showHotkeysMapDialog: new Subject<IHotkeyEvent>(),
        sidebarToggle: new Subject<IHotkeyEvent>(),
        toolbarToggle: new Subject<IHotkeyEvent>(),
        recentFiles: new Subject<IHotkeyEvent>(),
        recentFilters: new Subject<IHotkeyEvent>(),
        settings: new Subject<IHotkeyEvent>(),
        nextTab: new Subject<IHotkeyEvent>(),
        prevTab: new Subject<IHotkeyEvent>(),
    };

    constructor() {
        window.addEventListener('keyup', this._onKeyUp.bind(this));
        Object.keys(CLocalHotkeyMap).forEach((key: string) => {
            this._localKeys.push(CLocalHotkeyMap[key]);
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._cleanupShortcuts();
            this._subscriptions.onHotkeyCall = ElectronIpcService.subscribe(IPCMessages.HotkeyCall, this._onHotkeyCall.bind(this));
            this._subscriptions.onShowHotkeysMapDialog = this.getObservable().showHotkeysMapDialog.subscribe(this._onShowHotkeysMapDialog.bind(this));
            this._checkFocusedElement = this._checkFocusedElement.bind(this);
            window.addEventListener('mouseup', this._checkFocusedElement, true);
            window.addEventListener('keyup', this._checkFocusedElement, true);
            resolve();
        });
    }

    public getName(): string {
        return 'HotkeysService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            window.removeEventListener('mouseup', this._checkFocusedElement);
            window.removeEventListener('keyup', this._checkFocusedElement);
            resolve();
        });
    }

    public getObservable(): {
        newTab: Observable<IHotkeyEvent>,
        closeTab: Observable<IHotkeyEvent>,
        openLocalFile: Observable<IHotkeyEvent>,
        focusSearchInput: Observable<IHotkeyEvent>,
        openSearchFiltersTab: Observable<IHotkeyEvent>,
        selectNextRow: Observable<IHotkeyEvent>,
        selectPrevRow: Observable<IHotkeyEvent>,
        focusMainView: Observable<IHotkeyEvent>,
        focusSearchView: Observable<IHotkeyEvent>,
        showHotkeysMapDialog: Observable<IHotkeyEvent>,
        sidebarToggle: Observable<IHotkeyEvent>,
        toolbarToggle: Observable<IHotkeyEvent>,
        recentFiles: Observable<IHotkeyEvent>,
        recentFilters: Observable<IHotkeyEvent>,
        settings: Observable<IHotkeyEvent>,
        nextTab: Observable<IHotkeyEvent>,
        prevTab: Observable<IHotkeyEvent>,
    } {
        return {
            newTab: this._subjects.newTab.asObservable(),
            closeTab: this._subjects.closeTab.asObservable(),
            openLocalFile: this._subjects.openLocalFile.asObservable(),
            focusSearchInput: this._subjects.focusSearchInput.asObservable(),
            openSearchFiltersTab: this._subjects.openSearchFiltersTab.asObservable(),
            selectNextRow: this._subjects.selectNextRow.asObservable(),
            selectPrevRow: this._subjects.selectPrevRow.asObservable(),
            focusMainView: this._subjects.focusMainView.asObservable(),
            focusSearchView: this._subjects.focusSearchView.asObservable(),
            showHotkeysMapDialog: this._subjects.showHotkeysMapDialog.asObservable(),
            sidebarToggle: this._subjects.sidebarToggle.asObservable(),
            toolbarToggle: this._subjects.toolbarToggle.asObservable(),
            recentFiles: this._subjects.recentFiles.asObservable(),
            recentFilters: this._subjects.recentFilters.asObservable(),
            settings: this._subjects.settings.asObservable(),
            nextTab: this._subjects.nextTab.asObservable(),
            prevTab: this._subjects.prevTab.asObservable(),
        };
    }

    public pause() {
        ElectronIpcService.send(new IPCMessages.HotkeyPause()).then(() => {
            this._paused = true;
        });
    }

    public resume() {
        ElectronIpcService.send(new IPCMessages.HotkeyResume()).then(() => {
            this._paused = false;
        });
    }

    public inputIn() {
        ElectronIpcService.send(new IPCMessages.HotkeyInputIn()).then(() => {
            this._input = true;
        });
    }

    public inputOut() {
        ElectronIpcService.send(new IPCMessages.HotkeyInputOut()).then(() => {
            this._input = false;
        });
    }

    private _cleanupShortcuts() {
        const platform: string = Electron.remote.process.platform;
        Object.keys(CKeysMap).forEach((key: string) => {
            CKeysMap[key].shortkeys = CKeysMap[key].shortkeys.filter((shortkey: string) => {
                if (platform === 'darwin') {
                    return shortkey.indexOf('⌘') !== -1 ? true : (shortkey.indexOf('Ctrl') === -1 ? true : false);
                } else {
                    return shortkey.indexOf('⌘') === -1;
                }
            });
        });
    }

    private _onHotkeyCall(message: IPCMessages.HotkeyCall) {
        if (this._paused) {
            return;
        }
        if (this._input && message.shortcut.length === 1) {
            return;
        }
        if (this._subjects[message.action] === undefined) {
            this._logger.warn(`Unknown action "${message.action}"`);
            return;
        }
        this._subjects[message.action].next({
            session: message.session,
            unixtime: message.unixtime,
        });
    }

    private _onShowHotkeysMapDialog() {
        PopupsService.add({
            id: this._dialogGuid,
            options: {
                closable: true,
                width: 30,
                once: true,
            },
            caption: `Shortcuts`,
            component: {
                factory: DialogsHotkeysMapComponent,
                inputs: {
                    keys: CKeysMap
                }
            }
        });
    }

    private _checkFocusedElement() {
        // We have to use here litle delay, because some angular material components makes changes
        // asynch. To catch last state of components we have to let "them" update itselfs
        setTimeout(() => {
            const tag: string = document.activeElement.tagName.toLowerCase();
            if (['input', 'textarea'].indexOf(tag) !== -1) {
                this.inputIn();
            } else {
                this.inputOut();
            }
        }, 150);
    }

    private _getRefByKey(key: string): IPCMessages.EHotkeyActionRef | undefined {
        let result: IPCMessages.EHotkeyActionRef | undefined;
        Object.keys(CLocalHotkeyMap).forEach((ref: IPCMessages.EHotkeyActionRef) => {
            if (key === CLocalHotkeyMap[ref]) {
                result = ref;
            }
        });
        return result;
    }

    private _onKeyUp(event: KeyboardEvent) {
        if (this._localKeys.indexOf(event.key) === -1 || event.shiftKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const ref: IPCMessages.EHotkeyActionRef | undefined = this._getRefByKey(event.key);
        if (ref === undefined) {
            return;
        }
        ElectronIpcService.send(new IPCMessages.HotkeyLocalCall({
            shortcut: event.key,
            action: ref,
            unixtime: Date.now(),
        }));
    }

}

export default (new HotkeysService());

import * as Toolkit from 'chipmunk.client.toolkit';

import { Subscription } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import { DialogsHotkeysMapComponent } from '../components/dialogs/hotkeys/component';
import { IPC } from './service.electron.ipc';

import ElectronIpcService from './service.electron.ipc';
import PopupsService from './standalone/service.popups';
import ElectronEnvService from './service.electron.env';

export enum EHotkeyCategory {
    Files = 'Files',
    Focus = 'Focus',
    Tabs = 'Tabs',
    Movement = 'Movement',
    Areas = 'Areas',
    Search = 'Search',
    Other = 'Other'
}

export const CKeysMap: { [key: string]: {
    shortkeys: string[],
    description: string,
    category: EHotkeyCategory,
} } = {
    [IPC.EHotkeyActionRef.newTab]:                  { shortkeys: ['⌘ + T', 'Ctrl + T'],                         description: 'Open new tab',                    category: EHotkeyCategory.Tabs },
    [IPC.EHotkeyActionRef.closeTab]:                { shortkeys: ['⌘ + W', 'Ctrl + W'],                         description: 'Close active tab',                category: EHotkeyCategory.Tabs },
    [IPC.EHotkeyActionRef.nextTab]:                 { shortkeys: ['⌘ + Tab', 'Ctrl + Tab'],                     description: 'Next tab',                        category: EHotkeyCategory.Tabs },
    [IPC.EHotkeyActionRef.prevTab]:                 { shortkeys: ['Shift + ⌘ + Tab', 'Shift + Ctrl + Tab'],     description: 'Previous tab',                    category: EHotkeyCategory.Tabs },
    [IPC.EHotkeyActionRef.recentFiles]:             { shortkeys: ['⌘ + P', 'Ctrl + P'],                         description: 'Open recent files',               category: EHotkeyCategory.Files },
    [IPC.EHotkeyActionRef.recentFilters]:           { shortkeys: ['Shift + ⌘ + P', 'Shift + Ctrl + P'],         description: 'Open recent filters',             category: EHotkeyCategory.Files },
    [IPC.EHotkeyActionRef.openLocalFile]:           { shortkeys: ['⌘ + O', 'Ctrl + O'],                         description: 'Open local file',                 category: EHotkeyCategory.Files },
    [IPC.EHotkeyActionRef.openSearchFiltersTab]:    { shortkeys: ['Shift + ⌘ + F', 'Shift + Ctrl + F'],         description: 'Show filters tab',                category: EHotkeyCategory.Areas },
    [IPC.EHotkeyActionRef.selectNextRow]:           { shortkeys: ['j'],                                         description: 'Select next bookmarked row',      category: EHotkeyCategory.Movement },
    [IPC.EHotkeyActionRef.selectPrevRow]:           { shortkeys: ['k'],                                         description: 'Select previous bookmarked row',  category: EHotkeyCategory.Movement },
    [IPC.EHotkeyActionRef.scrollToBegin]:           { shortkeys: ['gg'],                                        description: 'Scroll to beginning of main output', category: EHotkeyCategory.Movement},
    [IPC.EHotkeyActionRef.scrollToEnd]:             { shortkeys: ['G'],                                         description: 'Scroll to end of main output',    category: EHotkeyCategory.Movement},
    [IPC.EHotkeyActionRef.focusSearchInput]:        { shortkeys: ['⌘ + F', 'Ctrl + F', '/'],                    description: 'Focus on search input',           category: EHotkeyCategory.Focus },
    [IPC.EHotkeyActionRef.focusMainView]:           { shortkeys: ['⌘ + 1', 'Ctrl + 1'],                         description: 'Focus on main output',            category: EHotkeyCategory.Focus },
    [IPC.EHotkeyActionRef.focusSearchView]:         { shortkeys: ['⌘ + 2', 'Ctrl + 2'],                         description: 'Focus on search results output',  category: EHotkeyCategory.Focus },
    [IPC.EHotkeyActionRef.sidebarToggle]:           { shortkeys: ['⌘ + B', 'Ctrl + B'],                         description: 'Toggle sidebar',                  category: EHotkeyCategory.Areas },
    [IPC.EHotkeyActionRef.toolbarToggle]:           { shortkeys: ['⌘ + J', 'Ctrl + J'],                         description: 'Toggle toolbar',                  category: EHotkeyCategory.Areas },
    [IPC.EHotkeyActionRef.settings]:                { shortkeys: ['⌘ + ,', 'Ctrl + ,'],                         description: 'Show settings',                   category: EHotkeyCategory.Other },
    [IPC.EHotkeyActionRef.showHotkeysMapDialog]:    { shortkeys: ['?'],                                         description: 'Show this dialog',                category: EHotkeyCategory.Other },
};

const CLocalHotkeyMap: { [key: string]: string } = {
    [IPC.EHotkeyActionRef.focusSearchInput]:        '/',
    [IPC.EHotkeyActionRef.selectNextRow]:           'j',
    [IPC.EHotkeyActionRef.selectPrevRow]:           'k',
    [IPC.EHotkeyActionRef.showHotkeysMapDialog]:    '?',
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
    private _combinationTimer: number = -1;
    private _combinationCounter: number = 0;
    private _localKeys: string[] = [];
    private _platform = '';

    private _subjects: { [key: string]: Subject<any> } = {
        newTab: new Subject<IHotkeyEvent>(),
        closeTab: new Subject<IHotkeyEvent>(),
        openLocalFile: new Subject<IHotkeyEvent>(),
        focusSearchInput: new Subject<IHotkeyEvent>(),
        openSearchFiltersTab: new Subject<IHotkeyEvent>(),
        selectNextRow: new Subject<IHotkeyEvent>(),
        selectPrevRow: new Subject<IHotkeyEvent>(),
        scrollToBegin: new Subject<IHotkeyEvent>(),
        scrollToEnd: new Subject<IHotkeyEvent>(),
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
        ctrlC: new Subject<IHotkeyEvent>(),
        selectAllSearchResult: new Subject<IHotkeyEvent>(),
    };

    constructor() {
        window.addEventListener('keyup', this._onKeyUp.bind(this));
        Object.keys(CLocalHotkeyMap).forEach((key: string) => {
            this._localKeys.push(CLocalHotkeyMap[key]);
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            ElectronEnvService.get().platform().then((platform: string) => {
                this._platform = platform;
                this._cleanupShortcuts(platform);
            }).catch((err: Error) => {
                this._logger.warn(`Fail get platform information due error: ${err.message}`);
            }).finally(() => {
                this._subscriptions.onHotkeyCall = ElectronIpcService.subscribe(IPC.HotkeyCall, this._onHotkeyCall.bind(this));
                this._subscriptions.onShowHotkeysMapDialog = this.getObservable().showHotkeysMapDialog.subscribe(this._onShowHotkeysMapDialog.bind(this));
                this._keydownCombination = this._keydownCombination.bind(this);
                this._checkFocusedElement = this._checkFocusedElement.bind(this);
                window.addEventListener('mouseup', this._checkFocusedElement, true);
                window.addEventListener('keyup', this._checkFocusedElement, true);
                window.addEventListener('keydown', this._keydownCombination, true);
                resolve();
            });
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
            window.removeEventListener('keydown', this._keydownCombination);
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
        scrollToBegin: Observable<IHotkeyEvent>,
        scrollToEnd: Observable<IHotkeyEvent>,
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
        ctrlC: Observable<IHotkeyEvent>,
        selectAllSearchResult: Observable<IHotkeyEvent>,
    } {
        return {
            newTab: this._subjects.newTab.asObservable(),
            closeTab: this._subjects.closeTab.asObservable(),
            openLocalFile: this._subjects.openLocalFile.asObservable(),
            focusSearchInput: this._subjects.focusSearchInput.asObservable(),
            openSearchFiltersTab: this._subjects.openSearchFiltersTab.asObservable(),
            selectNextRow: this._subjects.selectNextRow.asObservable(),
            selectPrevRow: this._subjects.selectPrevRow.asObservable(),
            scrollToBegin: this._subjects.scrollToBegin.asObservable(),
            scrollToEnd: this._subjects.scrollToEnd.asObservable(),
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
            ctrlC: this._subjects.ctrlC.asObservable(),
            selectAllSearchResult: this._subjects.selectAllSearchResult.asObservable(),
        };
    }

    public pause() {
        ElectronIpcService.send(new IPC.HotkeyPause()).then(() => {
            this._paused = true;
        });
    }

    public resume() {
        ElectronIpcService.send(new IPC.HotkeyResume()).then(() => {
            this._paused = false;
        });
    }

    public inputIn() {
        ElectronIpcService.send(new IPC.HotkeyInputIn()).then(() => {
            this._input = true;
        });
    }

    public inputOut() {
        ElectronIpcService.send(new IPC.HotkeyInputOut()).then(() => {
            this._input = false;
        });
    }

    public get platform(): string {
        return this._platform;
    }

    private _cleanupShortcuts(platform: string) {
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

    private _onHotkeyCall(message: IPC.HotkeyCall) {
        if (this._paused || message.shortcut === undefined) {
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
            if (document.activeElement === null) {
                return;
            }
            const tag: string = document.activeElement.tagName.toLowerCase();
            if (['input', 'textarea'].indexOf(tag) !== -1) {
                this.inputIn();
            } else {
                this.inputOut();
            }
        }, 150);
    }

    private _keydownCombination(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            this._subjects.ctrlC.next({
                session: undefined,
                unixtime: Date.now(),
            });
        } else if (!this._input) {
            if (event.key === 'G') {
                this._subjects.scrollToEnd.next({
                    session: undefined,
                    unixtime: Date.now(),
                });
            } else if (event.key === 'g') {
                this._gLowercase();
            }
        }
    }

    private _gLowercase() {
        this._combinationCounter++;
        if (this._combinationTimer === -1) {
            this._combinationTimer = window.setTimeout(() => {
                if (this._combinationCounter > 1) {
                    this._subjects.scrollToBegin.next({
                        session: undefined,
                        unixtime: Date.now(),
                    });
                }
                this._combinationCounter = 0;
                this._combinationTimer = -1;
            }, 250);
        }
    }

    private _getRefByKey(key: string): IPC.EHotkeyActionRef | undefined {
        let result: IPC.EHotkeyActionRef | undefined;
        Object.keys(CLocalHotkeyMap).forEach((ref: string) => {
            if (key === CLocalHotkeyMap[ref]) {
                result = ref as IPC.EHotkeyActionRef;
            }
        });
        return result;
    }

    private _onKeyUp(event: KeyboardEvent) {
        if (this._localKeys.indexOf(event.key) === -1 || event.shiftKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const ref: IPC.EHotkeyActionRef | undefined = this._getRefByKey(event.key);
        if (ref === undefined) {
            return;
        }
        ElectronIpcService.send(new IPC.HotkeyLocalCall({
            shortcut: event.key,
            action: ref,
            unixtime: Date.now(),
        }));
    }

}

export default (new HotkeysService());

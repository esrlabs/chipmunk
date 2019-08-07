declare var Electron: any;

import * as Toolkit from 'logviewer.client.toolkit';
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
    [IPCMessages.EHotkeyActionRef.newTab]:                  { shortkeys: ['⌘ + T', 'Ctrl + T'],                 description: 'Open new tab',                    category: EHotkeyCategory.Tabs },
    [IPCMessages.EHotkeyActionRef.closeTab]:                { shortkeys: ['⌘ + W', 'Ctrl + W'],                 description: 'Close active tab',                category: EHotkeyCategory.Tabs },
    [IPCMessages.EHotkeyActionRef.openTextFile]:            { shortkeys: ['⌘ + O', 'Ctrl + O'],                 description: 'Open text file',                  category: EHotkeyCategory.Files },
    [IPCMessages.EHotkeyActionRef.openDltFile]:             { shortkeys: ['⌘ + D', 'Ctrl + D'],                 description: 'Open DLT file',                   category: EHotkeyCategory.Files },
    [IPCMessages.EHotkeyActionRef.openSearchFiltersTab]:    { shortkeys: ['Shift + ⌘ + F', 'Shift + Ctrl + F'], description: 'Show filters tab',                category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.openMergeTab]:            { shortkeys: ['Shift + ⌘ + M', 'Shift + Ctrl + M'], description: 'Show merging tab',                category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.selectNextRow]:           { shortkeys: ['j'],                                 description: 'Select next row',                 category: EHotkeyCategory.Movement },
    [IPCMessages.EHotkeyActionRef.selectPrevRow]:           { shortkeys: ['k'],                                 description: 'Select previous row',             category: EHotkeyCategory.Movement },
    [IPCMessages.EHotkeyActionRef.focusSearchInput]:        { shortkeys: ['⌘ + F', 'Ctrl + F', '/'],            description: 'Focus on search input',           category: EHotkeyCategory.Focus },
    [IPCMessages.EHotkeyActionRef.focusMainView]:           { shortkeys: ['⌘ + 1', 'Ctrl + 1'],                 description: 'Focus on main output',            category: EHotkeyCategory.Focus },
    [IPCMessages.EHotkeyActionRef.focusSearchView]:         { shortkeys: ['⌘ + 2', 'Ctrl + 2'],                 description: 'Focus on search results output',  category: EHotkeyCategory.Focus },
    [IPCMessages.EHotkeyActionRef.sidebarToggle]:           { shortkeys: ['⌘ + B', 'Ctrl + B'],                 description: 'Toggle sidebar',                  category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.toolbarToggle]:           { shortkeys: ['⌘ + J', 'Ctrl + J'],                 description: 'Toggle toolbar',                  category: EHotkeyCategory.Areas },
    [IPCMessages.EHotkeyActionRef.showHotkeysMapDialog]:    { shortkeys: ['?'],                                 description: 'Show this dialog',                category: EHotkeyCategory.Other },
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

    private _subjects = {
        newTab: new Subject<IHotkeyEvent>(),
        closeTab: new Subject<IHotkeyEvent>(),
        openTextFile: new Subject<IHotkeyEvent>(),
        openDltFile: new Subject<IHotkeyEvent>(),
        focusSearchInput: new Subject<IHotkeyEvent>(),
        openSearchFiltersTab: new Subject<IHotkeyEvent>(),
        openMergeTab: new Subject<IHotkeyEvent>(),
        selectNextRow: new Subject<IHotkeyEvent>(),
        selectPrevRow: new Subject<IHotkeyEvent>(),
        focusMainView: new Subject<IHotkeyEvent>(),
        focusSearchView: new Subject<IHotkeyEvent>(),
        showHotkeysMapDialog: new Subject<IHotkeyEvent>(),
        sidebarToggle: new Subject<IHotkeyEvent>(),
        toolbarToggle: new Subject<IHotkeyEvent>(),
    };

    constructor() {
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
        openTextFile: Observable<IHotkeyEvent>,
        openDltFile: Observable<IHotkeyEvent>,
        focusSearchInput: Observable<IHotkeyEvent>,
        openSearchFiltersTab: Observable<IHotkeyEvent>,
        openMergeTab: Observable<IHotkeyEvent>,
        selectNextRow: Observable<IHotkeyEvent>,
        selectPrevRow: Observable<IHotkeyEvent>,
        focusMainView: Observable<IHotkeyEvent>,
        focusSearchView: Observable<IHotkeyEvent>,
        showHotkeysMapDialog: Observable<IHotkeyEvent>,
        sidebarToggle: Observable<IHotkeyEvent>,
        toolbarToggle: Observable<IHotkeyEvent>,
    } {
        return {
            newTab: this._subjects.newTab.asObservable(),
            closeTab: this._subjects.closeTab.asObservable(),
            openTextFile: this._subjects.openTextFile.asObservable(),
            openDltFile: this._subjects.openDltFile.asObservable(),
            focusSearchInput: this._subjects.focusSearchInput.asObservable(),
            openSearchFiltersTab: this._subjects.openSearchFiltersTab.asObservable(),
            openMergeTab: this._subjects.openMergeTab.asObservable(),
            selectNextRow: this._subjects.selectNextRow.asObservable(),
            selectPrevRow: this._subjects.selectPrevRow.asObservable(),
            focusMainView: this._subjects.focusMainView.asObservable(),
            focusSearchView: this._subjects.focusSearchView.asObservable(),
            showHotkeysMapDialog: this._subjects.showHotkeysMapDialog.asObservable(),
            sidebarToggle: this._subjects.sidebarToggle.asObservable(),
            toolbarToggle: this._subjects.toolbarToggle.asObservable(),
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
        const tag: string = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].indexOf(tag) !== -1) {
            this.pause();
        } else {
            this.resume();
        }
    }

}

export default (new HotkeysService());

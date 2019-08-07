import Logger from '../tools/env.logger';
import Subscription from '../tools/subscription';
import Subject from '../tools/subject';
import ServiceElectron, { IPCMessages } from './service.electron';
import ServiceStreams from './service.streams';
import { IService } from '../interfaces/interface.service';
import { app, globalShortcut } from 'electron';

const CHotkeyMap = {
    [IPCMessages.EHotkeyActionRef.newTab]:                  { darwin: ['Cmd+T'],            other: ['Ctrl+T'] },
    [IPCMessages.EHotkeyActionRef.closeTab]:                { darwin: ['Cmd+W'],            other: ['Ctrl+w'] },
    [IPCMessages.EHotkeyActionRef.openTextFile]:            { darwin: ['Cmd+O'],            other: ['Ctrl+O'] },
    [IPCMessages.EHotkeyActionRef.openDltFile]:             { darwin: ['Cmd+D'],            other: ['Ctrl+D'] },
    [IPCMessages.EHotkeyActionRef.focusSearchInput]:        { darwin: ['Cmd+F', '/'],       other: ['Ctrl+F', '/'] },
    [IPCMessages.EHotkeyActionRef.openSearchFiltersTab]:    { darwin: ['Shift+Cmd+F'],      other: ['Shift+Ctrl+F'] },
    [IPCMessages.EHotkeyActionRef.openMergeTab]:            { darwin: ['Shift+Cmd+M'],      other: ['Shift+Ctrl+M'] },
    [IPCMessages.EHotkeyActionRef.selectNextRow]:           {                               other: ['j'] },
    [IPCMessages.EHotkeyActionRef.selectPrevRow]:           {                               other: ['k'] },
    [IPCMessages.EHotkeyActionRef.focusMainView]:           { darwin: ['Cmd+1'],            other: ['Ctrl+1'] },
    [IPCMessages.EHotkeyActionRef.focusSearchView]:         { darwin: ['Cmd+2'],            other: ['Ctrl+2'] },
    [IPCMessages.EHotkeyActionRef.sidebarToggle]:           { darwin: ['Cmd+B'],            other: ['Ctrl+B'] },
    [IPCMessages.EHotkeyActionRef.toolbarToggle]:           { darwin: ['Cmd+J'],            other: ['Ctrl+J'] },
    [IPCMessages.EHotkeyActionRef.showHotkeysMapDialog]:    {                               other: ['?'] },
};

/**
 * @class ServiceHotkeys
 * @description Listens hotkeys
 */

class ServiceHotkeys implements IService {

    private _logger: Logger = new Logger('ServiceHotkeys');
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _subjects: {
        openTextFile: Subject,
        openDltFile: Subject,
    } = {
        openTextFile: new Subject('openTextFile'),
        openDltFile: new Subject('openDltFile'),
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.HotkeyResume, this._onHotkeyResume.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.onHotkeyResume = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.HotkeyPause, this._onHotkeyPause.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.onHotkeyPause = subscription;
                }),
            ]).then(() => {
                app.on('browser-window-blur', this._unbind.bind(this));
                app.on('browser-window-focus', this._bind.bind(this));
                this._bind();
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceHotkeys';
    }

    public getSubject(): {
        openTextFile: Subject,
        openDltFile: Subject,
    } {
        return this._subjects;
    }

    private _bind() {
        Object.keys(CHotkeyMap).forEach((action: string) => {
            const all: any = (CHotkeyMap as any)[action];
            const keys: string[] = all[process.platform] !== undefined ? all[process.platform] : all.other;
            keys.forEach((shortcut: string) => {
                globalShortcut.register(shortcut, () => {
                    if ((this._subjects as any)[action] !== undefined) {
                        (this._subjects as any)[action].emit();
                    }
                    ServiceElectron.IPC.send(new IPCMessages.HotkeyCall({
                        session: ServiceStreams.getActiveStreamId(),
                        unixtime: Date.now(),
                        action: action,
                    }));
                });
            });
        });
    }

    private _unbind() {
        globalShortcut.unregisterAll();
    }

    private _onHotkeyResume() {
        this._bind();
    }

    private _onHotkeyPause() {
        this._unbind();
    }

}

export default (new ServiceHotkeys());

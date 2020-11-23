import Logger from '../tools/env.logger';
import Subscription from '../tools/subscription';
import Subject from '../tools/subject';
import ServiceElectron, { IPCMessages } from './service.electron';
import ServiceStreams from './service.sessions';
import { IService } from '../interfaces/interface.service';
import { app, globalShortcut } from 'electron';

const CHotkeyMap = {
    [IPCMessages.EHotkeyActionRef.newTab]:                  { darwin: ['Cmd+T'],                other: ['Ctrl+T'] },
    [IPCMessages.EHotkeyActionRef.closeTab]:                { darwin: ['Cmd+W'],                other: ['Ctrl+w'] },
    [IPCMessages.EHotkeyActionRef.openLocalFile]:           { darwin: ['Cmd+O'],                other: ['Ctrl+O'] },
    [IPCMessages.EHotkeyActionRef.focusSearchInput]:        { darwin: ['Cmd+F'],                other: ['Ctrl+F'] },
    [IPCMessages.EHotkeyActionRef.openSearchFiltersTab]:    { darwin: ['Shift+Cmd+F'],          other: ['Shift+Ctrl+F'] },
    [IPCMessages.EHotkeyActionRef.selectNextRow]:           { darwin: ['Cmd+['],                other: ['Ctrl+['] },
    [IPCMessages.EHotkeyActionRef.selectPrevRow]:           { darwin: ['Cmd+]'],                other: ['Ctrl+]'] },
    [IPCMessages.EHotkeyActionRef.focusMainView]:           { darwin: ['Cmd+1'],                other: ['Ctrl+1'] },
    [IPCMessages.EHotkeyActionRef.focusSearchView]:         { darwin: ['Cmd+2'],                other: ['Ctrl+2'] },
    [IPCMessages.EHotkeyActionRef.sidebarToggle]:           { darwin: ['Cmd+B'],                other: ['Ctrl+B'] },
    [IPCMessages.EHotkeyActionRef.toolbarToggle]:           { darwin: ['Cmd+J'],                other: ['Ctrl+J'] },
    [IPCMessages.EHotkeyActionRef.recentFiles]:             { darwin: ['Cmd+P'],                other: ['Ctrl+P'] },
    [IPCMessages.EHotkeyActionRef.recentFilters]:           { darwin: ['Shift+Cmd+P'],          other: ['Shift+Ctrl+P'] },
    [IPCMessages.EHotkeyActionRef.settings]:                { darwin: ['Cmd+,'],                other: ['Ctrl+,'] },
    [IPCMessages.EHotkeyActionRef.prevTab]:                 { darwin: ['Shift+Control+Tab'],    other: ['Shift+Ctrl+Tab'] },
    [IPCMessages.EHotkeyActionRef.nextTab]:                 { darwin: ['Control+Tab'],          other: ['Ctrl+Tab'] },
    [IPCMessages.EHotkeyActionRef.showHotkeysMapDialog]:    {                                   other: ['?'] },
};

const CInputRelatedHotkeys = [
    'j',
    'k',
    'J',
    'K',
    ',',
    '/',
    '?',
];

export interface IServiceSubjects {
    openLocalFile: Subject<void>;
}

/**
 * @class ServiceHotkeys
 * @description Listens hotkeys
 */

class ServiceHotkeys implements IService {

    private _logger: Logger = new Logger('ServiceHotkeys');
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _locked: boolean = false;
    private _subjects: IServiceSubjects = {
        openLocalFile: new Subject('openLocalFile'),
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
                ServiceElectron.IPC.subscribe(IPCMessages.HotkeyPause, this._onHotkeyPause.bind(this, false)).then((subscription: Subscription) => {
                    this._subscriptions.onHotkeyPause = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.HotkeyInputOut, this._onHotkeyResume.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.onHotkeyInputOut = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.HotkeyInputIn, this._onHotkeyPause.bind(this, true)).then((subscription: Subscription) => {
                    this._subscriptions.onHotkeyInputIn = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.HotkeyLocalCall, this._onHotkeyLocalCall.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.onHotkeyLocalCall = subscription;
                }),
            ]).then(() => {
                app.on('browser-window-blur', this._unbind.bind(this, false));
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
            this._unbind();
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceHotkeys';
    }

    public getSubject(): IServiceSubjects {
        return this._subjects;
    }

    private _bind() {
        this._locked = false;
        Object.keys(CHotkeyMap).forEach((action: string) => {
            const all: any = (CHotkeyMap as any)[action];
            const keys: string[] = all[process.platform] !== undefined ? all[process.platform] : all.other;
            keys.forEach((shortcut: string) => {
                if (globalShortcut.isRegistered(shortcut)) {
                    return;
                }
                if (!globalShortcut.register(shortcut, this._send.bind(this, action, shortcut))) {
                    this._logger.warn(`Fail to register key "${shortcut}" for action "${action}" as shortcut.`);
                }
            });
        });
    }

    private _unbind(input: boolean = false) {
        if (!input) {
            globalShortcut.unregisterAll();
            this._locked = true;
        } else {
            CInputRelatedHotkeys.forEach((shortcut: string) => {
                if (!globalShortcut.isRegistered(shortcut)) {
                    return;
                }
                globalShortcut.unregister(shortcut);
            });
        }
    }

    private _onHotkeyResume() {
        if (this._locked) {
            return;
        }
        this._bind();
    }

    private _onHotkeyPause(input: boolean = false) {
        this._unbind(input);
    }

    private _onHotkeyLocalCall(message: IPCMessages.TMessage) {
        const msg: IPCMessages.HotkeyLocalCall = message as IPCMessages.HotkeyLocalCall;
        if (this._locked) {
            return;
        }
        this._send(msg.action, msg.shortcut);
    }

    private _send(action: string, shortcut: string) {
        if ((this._subjects as any)[action] !== undefined) {
            (this._subjects as any)[action].emit();
        }
        const session: string | undefined = ServiceStreams.getActiveSessionUUID();
        if (session === undefined) {
            return;
        }
        ServiceElectron.IPC.send(new IPCMessages.HotkeyCall({
            session: session,
            unixtime: Date.now(),
            action: action,
            shortcut: shortcut,
        })).catch((error: Error) => {
            this._logger.error(error.message);
        });
    }

}

export default (new ServiceHotkeys());

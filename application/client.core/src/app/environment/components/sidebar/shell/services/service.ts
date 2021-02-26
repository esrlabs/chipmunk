import { IShellProcess } from '../../../../../../../../common/ipc/electron.ipc.messages';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';
import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import SourcesService from '../../../../services/service.sources';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ShellService {

    private _session: Session | undefined;
    private _subscriptions: { [key: string]:  Toolkit.Subscription | Subscription } = {};
    private _processes: { [session: string]:  IShellProcess[] } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellService');

    constructor() {
        this._session = TabsSessionsService.getActive();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClose = EventsSessionService.getObservable().onSessionClosed.subscribe(this._onSessionClose.bind(this));
        this._subscriptions.shellProcessListEvent = ElectronIpcService.subscribe(IPCMessages.ShellProcessListEvent, this._onListUpdate.bind(this));
    }

    public removeProcess(session: string, guid: string) {
        if (this._processes[session] !== undefined) {
            this._processes[session] = this._processes[session].filter((process: IShellProcess) => {
                return process.guid !== guid;
            });
        }
    }

    public get session(): Session | undefined {
        return this._session;
    }

    public get processes(): IShellProcess[] {
        const procs = this._processes[this._session.getGuid()]
        return procs === undefined ? [] : procs;
    }

    private _onListUpdate(response: IPCMessages.ShellProcessListEvent) {
        this._processes[response.session] = response.processes;
        this._processes[response.session].forEach((process: IShellProcess) => {
            if (process.meta.color.trim() === '' || process.meta.color === undefined) {
                process.meta.color = SourcesService.getSourceColor(process.meta.sourceId);   
            }
        });
    }

    private _onSessionClose(session: string) {
        delete this._processes[session];
    }

    private _onSessionChange(session: Session | undefined) {
        this._session = session;
    }

}

export default (new ShellService());

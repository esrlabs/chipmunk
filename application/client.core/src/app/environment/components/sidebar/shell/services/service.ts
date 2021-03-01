import { IShellProcess } from '../../../../../../../../common/ipc/electron.ipc.messages';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';
import { IPair } from '../../../../thirdparty/code/engine';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';
import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import SourcesService from '../../../../services/service.sources';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IInformation {
    env: { [key: string]: string};
    shells: string[];
    shell: string;
    pwd: string;
}

export class ShellService {

    private _session: Session | undefined;
    private _subscriptions: { [key: string]:  Toolkit.Subscription | Subscription } = {};
    private _processes: { [session: string]:  IShellProcess[] } = {};

    constructor() {
        this._session = TabsSessionsService.getActive();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClose = EventsSessionService.getObservable().onSessionClosed.subscribe(this._onSessionClose.bind(this));
        this._subscriptions.shellProcessListEvent = ElectronIpcService.subscribe(IPCMessages.ShellProcessListEvent, this._onListUpdate.bind(this));
    }

    public terminate(process: IShellProcess): Promise<void> {
        const session: string = this._session.getGuid();
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessKillRequest({ session: session, guid: process.guid }), IPCMessages.ShellProcessKillResponse).then((response: IPCMessages.ShellProcessKillResponse) => {
            if (response.error !== undefined) {
                reject(`Fail to terminate process "${process.command}" due error: ${response.error}`);
            } else {
                this._removeProcess(session, process.guid);
                resolve();
            }
            }).catch((error: Error) => {
                reject(`Fail to terminate process "${process.command}" due error: ${error.message}`);
            });
        });
    }

    public getEnv(): Promise<IInformation> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellEnvRequest({ session: this._session.getGuid() }), IPCMessages.ShellEnvResponse).then((response: IPCMessages.ShellEnvResponse) => {
                if (response.error !== undefined) {
                    reject(`Failed to reqeust environment information due to Error: ${response.error}`);
                } else {
                    resolve({
                        env: Object.assign({}, response.env),
                        shells: [...response.shells],
                        shell: response.shell,
                        pwd: response.pwd,
                    });
                }
            }).catch((error: Error) => {
                reject(`Failed to reqeust environment information due to Error: ${error}`);
            });
        });
    }

    public clearRecent(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellRecentCommandsClearRequest(), IPCMessages.ShellRecentCommandsClearResponse).then((response: IPCMessages.ShellRecentCommandsClearResponse) => {
                if (response.error) {
                    return reject(`Fail to reset recent commands due error: ${response.error}`);
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Fail send request to reset recent commands due error: ${error.message}`);
            });
        });
    }

    public runCommand(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessRunRequest({ session: this._session.getGuid(), command: command }), IPCMessages.ShellProcessRunResponse).then((response: IPCMessages.ShellProcessRunResponse) => {
                if (response.error !== undefined) {
                    return reject(`Failed to run command due Error: ${response.error}`);
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Failed to run command due Error: ${error.message}`);
            });
        });
    }

    public loadRecentCommands(): Promise<IPair[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellRecentCommandsRequest(), IPCMessages.ShellRecentCommandsResponse).then((response: IPCMessages.ShellRecentCommandsResponse) => {
                resolve(response.commands.map((recent: string) => {
                    return {
                        id: '',
                        caption: ' ',
                        description: recent,
                        tcaption: ' ',
                        tdescription: recent
                    };
                }));
            }).catch((error: Error) => {
                reject(`Fail to get list of recent commands due error: ${error.message}`);
            });
        });
    }

    public get session(): Session | undefined {
        return this._session;
    }

    public get processes(): IShellProcess[] {
        const procs = this._processes[this._session.getGuid()];
        return procs === undefined ? [] : procs;
    }

    private _removeProcess(session: string, guid: string) {
        if (this._processes[session] !== undefined) {
            this._processes[session] = this._processes[session].filter((process: IShellProcess) => {
                return process.guid !== guid;
            });
        }
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

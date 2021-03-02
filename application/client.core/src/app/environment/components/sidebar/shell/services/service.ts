import { IShellProcess } from '../../../../../../../../common/ipc/electron.ipc.messages';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';
import { IPair } from '../../../../thirdparty/code/engine';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';
import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';

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

    constructor() {
        this._session = TabsSessionsService.getActive();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public terminate(process: IShellProcess): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessKillRequest({ session: this._session.getGuid(), guid: process.guid }), IPCMessages.ShellProcessKillResponse).then((response: IPCMessages.ShellProcessKillResponse) => {
                if (response.error !== undefined) {
                    return reject(`Fail to terminate process "${process.command}" due error: ${response.error}`);
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Fail to terminate process "${process.command}" due error: ${error.message}`);
            });
        });
    }

    public getRunning(sessionID: string): Promise<IPCMessages.ShellProcessListResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessListRequest({ session: sessionID }), IPCMessages.ShellProcessListResponse).then((response: IPCMessages.ShellProcessListResponse) => {
                resolve(response);
            }).catch((error: Error) => {
                reject(`Fail to get running processes due error: ${error.message}`);
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

    public getDetails(guid: string): Promise<IPCMessages.IShellProcess> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessDetailsRequest({ session: this._session.getGuid(), guid: guid }), IPCMessages.ShellProcessDetailsResponse).then((response: IPCMessages.ShellProcessDetailsResponse) => {
                if (response.error !== undefined) {
                    reject(`Failed to reqeust process details due to Error: ${response.error}`);
                } else {
                    resolve(response.info);
                }
            }).catch((error: Error) => {
                reject(`Failed to send a process details reqeust due to Error: ${error}`);
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

    private _onSessionChange(session: Session | undefined) {
        this._session = session;
    }

}

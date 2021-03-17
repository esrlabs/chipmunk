import { Subscription } from 'rxjs';
import { IPair } from '../../../../thirdparty/code/engine';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IInformation {
    env: { [key: string]: string};
    shells: string[];
    shell: string;
    pwd: string;
}

export interface ISettings {
    env?: { [key: string]: string };
    shell?: string;
    pwd?: string;
}

export class ShellService {

    private _subscriptions: { [key: string]:  Toolkit.Subscription | Subscription } = {};

    constructor() { }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public terminate(request: IPCMessages.IShellProcessKillRequest, command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessKillRequest(request), IPCMessages.ShellProcessKillResponse).then((response: IPCMessages.ShellProcessKillResponse) => {
                if (response.error !== undefined) {
                    return reject(`Fail to terminate process "${command}" due error: ${response.error}`);
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Fail to terminate process "${command}" due error: ${error.message}`);
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

    public getTerminated(sessionID: string): Promise<IPCMessages.ShellProcessTerminatedListResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessTerminatedListRequest({ session: sessionID }), IPCMessages.ShellProcessTerminatedListResponse).then((response: IPCMessages.ShellProcessTerminatedListResponse) => {
                resolve(response);
            }).catch((error: Error) => {
                reject(`Fail to get terminated processes due error: ${error.message}`);
            });
        });
    }

    public getEnv(request: IPCMessages.IShellEnvRequest): Promise<IInformation> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellEnvRequest(request), IPCMessages.ShellEnvResponse).then((response: IPCMessages.ShellEnvResponse) => {
                if (response.error !== undefined) {
                    reject(`Failed to reqeust environment information due to Error: ${response.error}`);
                } else {
                    resolve({
                        env: response.env,
                        shells: response.shells,
                        shell: response.shell,
                        pwd: response.pwd,
                    });
                }
            }).catch((error: Error) => {
                reject(`Failed to reqeust environment information due to Error: ${error}`);
            });
        });
    }

    public setEnv(request: IPCMessages.IShellSetEnvRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellSetEnvRequest(
                {
                    pwd: request.pwd,
                    shell: request.shell,
                    session: request.session,
                    env: request.env,
                }
            ), IPCMessages.ShellSetEnvResponse).then((response: IPCMessages.ShellSetEnvResponse) => {
                if (response.error !== undefined) {
                    reject(`Failed to set environment due to Error: ${response.error}`);
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Failed to set environment due to Error: ${error}`);
            });
        });
    }

    public getDetails(request: IPCMessages.IShellProcessDetailsRequest): Promise<IPCMessages.IShellProcess> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessDetailsRequest(request), IPCMessages.ShellProcessDetailsResponse).then((response: IPCMessages.ShellProcessDetailsResponse) => {
                if (response.error !== undefined) {
                    reject(`Failed to reqeust process details of due to Error: ${response.error}`);
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

    public runCommand(request: IPCMessages.IShellProcessRunRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessRunRequest(request), IPCMessages.ShellProcessRunResponse).then((response: IPCMessages.ShellProcessRunResponse) => {
                if (response.error !== undefined) {
                    return reject(`Failed to run command ${request.command} due Error: ${response.error}`);
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Failed to run command ${request.command} due Error: ${error.message}`);
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

    public setPwd(request: IPCMessages.IShellPwdRequest): Promise<string> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPwdRequest(request), IPCMessages.ShellPwdResponse).then((response: IPCMessages.ShellPwdResponse) => {
                if (response.error !== undefined) {
                    return reject(`Failed to set pwd due to the error: ${response.error}`);
                }
                resolve(response.path);
            }).catch((error: Error) => {
                reject(`Failed to set pwd due to the error: ${error.message}`);
            });
        });
    }

}

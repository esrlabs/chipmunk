import { Observable, Subscription, Subject } from 'rxjs';
import { IPair } from '../../../../thirdparty/code/engine';
import { IEnvironment, INewInformation } from '../input/component';
import { Session } from '../../../../controller/session/session';
import { copy } from '../../../../../../../../client.libs/chipmunk.client.toolkit/src/tools/tools.object';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IPresetInfo {
    pwd?: string;
    shell?: string;
    env?: IEnvironment[];
}

export class ShellService {

    public saveAs: string = 'Save as..';
    public presets: IPCMessages.IPreset[] = [
        {
            custom: false,
            title: this.saveAs,
            information: {
                pwd: '',
                shell: '',
                env: [],
            }
        }, {
            title: 'Default',
            custom: false,
            information: {
                pwd: '',
                shell: '',
                env: [],
            }
        }
    ];
    public selectedPreset: IPCMessages.IPreset = this.presets[1];

    private _sessionID: string;
    private _shells: string[] = [];
    private _defaultInformation: INewInformation;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellService');
    private _subscriptions: { [key: string]:  Toolkit.Subscription | Subscription } = {};
    private subjects: {
        restored: Subject<void>,
    } = {
        restored: new Subject<void>(),
    };

    constructor() {
        this._sessionID = TabsSessionsService.getActive().getGuid();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._init();
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public get shells(): string[] {
        return this._shells;
    }

    public get defaultInformation(): INewInformation {
        return this._defaultInformation;
    }

    public getObservable(): {
        restored: Observable<void>,
    } {
        return {
            restored: this.subjects.restored.asObservable(),
        };
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

    public getEnv(request: IPCMessages.IShellEnvRequest): Promise<INewInformation> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellEnvRequest(request), IPCMessages.ShellEnvResponse).then((response: IPCMessages.ShellEnvResponse) => {
                if (response.error !== undefined) {
                    reject(`Failed to reqeust environment information due to Error: ${response.error}`);
                } else {
                    this._shells = response.shells;
                    this._defaultInformation = {
                        env: this._convertEnv(response.env),
                        shell: response.shell,
                        pwd: response.pwd
                    };
                    if (this.presets[1].information.pwd.trim() === '') {
                        this.presets[1].information = copy(this._defaultInformation);
                        this.setPreset(request.session);
                    }
                    resolve(this._defaultInformation);
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

    public runCommand(request: { session: string; command: string}): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessRunRequest({ session: request.session, command: request.command, pwd: this.selectedPreset.information.pwd, shell: this.selectedPreset.information.shell }), IPCMessages.ShellProcessRunResponse).then((response: IPCMessages.ShellProcessRunResponse) => {
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
                resolve(response.value);
            }).catch((error: Error) => {
                reject(`Failed to set pwd due to the error: ${error.message}`);
            });
        });
    }

    public setPreset(session: string, info?: IPresetInfo): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPresetSetRequest({ session: session, preset: (info === undefined ? this.selectedPreset : { title: this.selectedPreset.title, custom: this.selectedPreset.custom, information: info })}), IPCMessages.ShellPresetSetResponse).then((response: IPCMessages.ShellPresetSetResponse) => {
                resolve();
            }).catch((error: Error) => {
                reject(`Failed to set preset due to the error: ${error.message}`);
            });
        });
    }

    public getPreset(session: string): Promise<IPCMessages.IShellPresetGetResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPresetGetRequest({ session: session }), IPCMessages.ShellPresetGetResponse).then((response: IPCMessages.ShellPresetGetResponse) => {
                resolve(response);
            }).catch((error: Error) => {
                reject(`Failed to get presets due to the error: ${error.message}`);
            });
        });
    }

    public removePreset(request: IPCMessages.IShellPresetRemoveRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPresetRemoveRequest({ session: request.session, title: request.title }), IPCMessages.ShellPresetRemoveResponse).then((response: IPCMessages.ShellPresetRemoveResponse) => {
                resolve();
            }).catch((error: Error) => {
                reject(`Failed to remove preset due to the error: ${error.message}`);
            });
        });
    }

    public restoreSession(request: IPCMessages.IShellLoadRequest, outside: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellLoadRequest(request), IPCMessages.ShellLoadResponse).then((response: IPCMessages.ShellLoadResponse) => {
                if (response.presetTitle.trim() === '') {
                    return resolve();
                }
                this.presets.forEach((preset: IPCMessages.IPreset) => {
                    if (preset.title === response.presetTitle) {
                        this.selectedPreset = preset;
                    }
                });
                if (!outside) {
                    this.subjects.restored.next();
                }
                resolve();
            }).catch((error: Error) => {
                reject(`Fail to restore preset settings in session ${request.session} due to the error: ${error.message}`);
            });
        });
    }

    private _init() {
        this.getPreset(this._sessionID).then((response: IPCMessages.IShellPresetGetResponse) => {
            if (response.session !== this._sessionID) {
                return;
            }
            if (response.presets.length > 0) {
                for (const preset of response.presets) {
                    if (preset.title === 'Default') {
                        this.presets[1].information = copy(preset.information);
                        break;
                    }
                }
                this.presets.push(...response.presets.filter((preset: IPCMessages.IPreset) => {
                    return preset.title !== 'Default';
                }));
            }
            this.getEnv({ session: this._sessionID }).catch((error: Error) => {
                this._logger.error(`Failed to get environment information due to the error: ${error.message}`);
            });
        }).catch((error: Error) => {
            this._logger.error(`Failed to initialize service due to the error: ${error.message}`);
        });
    }

    private _convertEnv(environment: {[key: string]: string}): IEnvironment[] {
        const env: IEnvironment[] = [];
        Object.keys(environment).forEach((variable: string) => {
            env.push({
                value: environment[variable],
                variable: variable,
                custom: false,
                editing: {
                    value: false,
                    variable: false,
                },
                selected: false,
            });
        });
        return env;
    }

    private _saveSession(request: IPCMessages.IShellSaveRequest) {
        ElectronIpcService.request(new IPCMessages.ShellSaveRequest(request), IPCMessages.ShellSaveResponse)
            .then((response: IPCMessages.ShellSaveResponse) => {})
            .catch((error: Error) => {
                this._logger.error(`Fail to save preset settings in session ${request.session} due to error: ${error.message}`);
            });
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._saveSession({ session: this._sessionID, presetTitle: this.selectedPreset.title });
            this._sessionID = session.getGuid();
            this.restoreSession({ session: this._sessionID }).catch((error: Error) => {
                this._logger.error(error.message);
            });
        }
    }

}

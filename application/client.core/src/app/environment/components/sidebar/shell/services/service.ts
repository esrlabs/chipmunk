import { Observable, Subscription, Subject } from 'rxjs';
import { IPair } from '../../../../thirdparty/code/engine';
import { IEnvironment, INewInformation } from '../environment/component';
import { Session } from '../../../../controller/session/session';
import { copy } from '../../../../../../../../client.libs/chipmunk.client.toolkit/src/tools/tools.object';
import { IPreset } from '../../../../../../../../common/ipc/electron.ipc.messages';

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

    public readonly saveAs: string = 'Save as..';

    private _presets: IPCMessages.IPreset[] = [
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
    private _sessionID: string;
    private _shells: string[] = [];
    private _defaultInformation: INewInformation;
    private _selectedPresetTitle: string = this._presets[1].title;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellService');
    private _subscriptions: { [key: string]:  Toolkit.Subscription | Subscription } = {};
    private _subjects: {
        onRestored: Subject<void>,
        onShellChange: Subject<string>,
    } = {
        onRestored: new Subject<void>(),
        onShellChange: new Subject<string>(),
    };

    constructor() {
        const session: Session = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
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

    public get presets(): IPCMessages.IPreset[] {
        return this._presets.slice();
    }

    public set selectedPresetTitle(title: string) {
        this._selectedPresetTitle = title;
    }

    public get selectedPresetTitle(): string {
        return this._selectedPresetTitle;
    }

    public getObservable(): {
        onRestored: Observable<void>,
        onShellChange: Observable<string>,
    } {
        return {
            onRestored: this._subjects.onRestored.asObservable(),
            onShellChange: this._subjects.onShellChange.asObservable(),
        };
    }

    public resetSelectedPreset() {
        this._getPreset(this._selectedPresetTitle).information = copy(this._defaultInformation);
        this.setPreset(this._sessionID).catch((error: Error) => {
            this._logger.error(error.message);
        });
        this._subjects.onShellChange.next(this.defaultInformation.shell);
    }

    public terminate(request: IPCMessages.IShellProcessKillRequest, command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessKillRequest(request), IPCMessages.ShellProcessKillResponse).then((response: IPCMessages.ShellProcessKillResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(`Fail to terminate process "${command}" due error: ${response.error}`));
                }
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Fail to terminate process "${command}" due error: ${error.message}`));
            });
        });
    }

    public getRunning(sessionID: string): Promise<IPCMessages.ShellProcessListResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessListRequest({ session: sessionID }), IPCMessages.ShellProcessListResponse).then((response: IPCMessages.ShellProcessListResponse) => {
                resolve(response);
            }).catch((error: Error) => {
                reject(new Error(`Fail to get running processes due error: ${error.message}`));
            });
        });
    }

    public getTerminated(sessionID: string): Promise<IPCMessages.ShellProcessTerminatedListResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessTerminatedListRequest({ session: sessionID }), IPCMessages.ShellProcessTerminatedListResponse).then((response: IPCMessages.ShellProcessTerminatedListResponse) => {
                resolve(response);
            }).catch((error: Error) => {
                reject(new Error(`Fail to get terminated processes due error: ${error.message}`));
            });
        });
    }

    public getEnv(request: IPCMessages.IShellEnvRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellEnvRequest(request), IPCMessages.ShellEnvResponse).then((response: IPCMessages.ShellEnvResponse) => {
                if (response.error !== undefined) {
                    reject(new Error(`Failed to reqeust environment information due to Error: ${response.error}`));
                } else {
                    this._shells = response.shells;
                    this._defaultInformation = {
                        env: this._convertEnv(response.env),
                        shell: response.shell,
                        pwd: response.pwd
                    };
                    if (this._presets[1].information.pwd.trim() === '') {
                        this._presets[1].information = copy(this._defaultInformation);
                        this.setPreset(request.session);
                    }
                    resolve();
                }
            }).catch((error: Error) => {
                reject(new Error(`Failed to reqeust environment information due to Error: ${error.message}`));
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
                    reject(new Error(`Failed to set environment due to Error: ${response.error}`));
                }
                const selectedPreset = this._getPreset(this._selectedPresetTitle);
                if (request.shell !== undefined) {
                    selectedPreset.information.shell = request.shell;
                }
                if (request.pwd !== undefined) {
                    selectedPreset.information.pwd = request.pwd;
                }
                if (request.env !== undefined) {
                    selectedPreset.information.env = copy(request.env);
                }
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Failed to set environment due to Error: ${error.message}`));
            });
        });
    }

    public getDetails(request: IPCMessages.IShellProcessDetailsRequest): Promise<IPCMessages.IShellProcess> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellProcessDetailsRequest(request), IPCMessages.ShellProcessDetailsResponse).then((response: IPCMessages.ShellProcessDetailsResponse) => {
                if (response.error !== undefined) {
                    reject(new Error(`Failed to reqeust process details of due to Error: ${response.error}`));
                } else {
                    resolve(response.info);
                }
            }).catch((error: Error) => {
                reject(new Error(`Failed to send a process details reqeust due to Error: ${error.message}`));
            });
        });
    }

    public clearRecent(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellRecentCommandsClearRequest(), IPCMessages.ShellRecentCommandsClearResponse).then((response: IPCMessages.ShellRecentCommandsClearResponse) => {
                if (response.error) {
                    return reject(new Error(`Fail to reset recent commands due error: ${response.error}`));
                }
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Fail send request to reset recent commands due error: ${error.message}`));
            });
        });
    }

    public runCommand(request: { session: string; command: string}): Promise<void> {
        return new Promise((resolve, reject) => {
            const preset: IPreset = this._getPreset(this._selectedPresetTitle);
            ElectronIpcService.request(new IPCMessages.ShellProcessRunRequest({ session: request.session, command: request.command, pwd: preset.information.pwd, shell: preset.information.shell }), IPCMessages.ShellProcessRunResponse).then((response: IPCMessages.ShellProcessRunResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(`Failed to run command ${request.command} due Error: ${response.error}`));
                }
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Failed to run command ${request.command} due Error: ${error.message}`));
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
                reject(new Error(`Fail to get list of recent commands due error: ${error.message}`));
            });
        });
    }

    public removeRecentCommand(request: IPCMessages.IShellRecentCommandsRemove): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.send(new IPCMessages.ShellRecentCommandsRemove(request)).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Failed to remove recent command due error: ${error.message}`));
            });
        });
    }

    public setPwd(request: IPCMessages.IShellPwdRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPwdRequest(request), IPCMessages.ShellPwdResponse).then((response: IPCMessages.ShellPwdResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(`Failed to set pwd due to the error: ${response.error}`));
                }
                if (response.value.trim() !== '') {
                    this._getPreset(this._selectedPresetTitle).information.pwd = response.value;
                    this.setPreset(this._sessionID, { pwd: response.value }).catch((error: Error) => {
                        reject(`Failed to set pwd of preset due to the error ${error.message}`);
                    });
                }
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Failed to set pwd due to the error: ${error.message}`));
            });
        });
    }

    public setPreset(session: string, info?: IPresetInfo): Promise<void> {
        return new Promise((resolve, reject) => {
            const preset: IPreset = this._getPreset(this._selectedPresetTitle);
            ElectronIpcService.request(new IPCMessages.ShellPresetSetRequest({ session: session, preset: (info === undefined ? preset : { title: preset.title, custom: preset.custom, information: info })}), IPCMessages.ShellPresetSetResponse).then((response: IPCMessages.ShellPresetSetResponse) => {
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Failed to set preset due to the error: ${error.message}`));
            });
        });
    }

    public removePreset(request: IPCMessages.IShellPresetRemoveRequest): Promise<void> {
        this._presets = this._presets.filter((preset: IPreset) => {
            return preset.title !== this._selectedPresetTitle;
        });
        this._selectedPresetTitle = this._presets[this._presets.length - 1].title;
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPresetRemoveRequest({ session: request.session, title: request.title }), IPCMessages.ShellPresetRemoveResponse).then((response: IPCMessages.ShellPresetRemoveResponse) => {
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Failed to remove preset due to the error: ${error.message}`));
            });
        });
    }

    public restoreSession(request: IPCMessages.IShellLoadRequest, outside: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellLoadRequest(request), IPCMessages.ShellLoadResponse).then((response: IPCMessages.ShellLoadResponse) => {
                if (response.presetTitle.trim() === '') {
                    return resolve();
                }
                this._presets.forEach((preset: IPCMessages.IPreset) => {
                    if (preset.title === response.presetTitle) {
                        this._selectedPresetTitle = preset.title;
                    }
                });
                if (!outside) {
                    this._subjects.onRestored.next();
                }
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Fail to restore preset settings in session ${request.session} due to the error: ${error.message}`));
            });
        });
    }

    public addPreset(title: string, prev: string): number {
        return this._presets.push({
            title: title,
            information: copy(this._getPreset(prev).information),
            custom: true,
        });
    }

    public getPreset(title: string): IPreset {
        return copy(this._getPreset(title));
    }

    public _getPreset(title: string): IPreset {
        const preset = this._presets.find((_: IPreset) => _.title === title);
        return preset === undefined ? this._presets[1] : preset;
    }

    private _getPresets(session: string): Promise<IPCMessages.IShellPresetGetResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.ShellPresetGetRequest({ session: session }), IPCMessages.ShellPresetGetResponse).then((response: IPCMessages.ShellPresetGetResponse) => {
                resolve(response);
            }).catch((error: Error) => {
                reject(new Error(`Failed to get presets due to the error: ${error.message}`));
            });
        });
    }

    private _init() {
        this._getPresets(this._sessionID).then((response: IPCMessages.IShellPresetGetResponse) => {
            if (response.session !== this._sessionID) {
                return;
            }
            if (response.presets.length > 0) {
                for (const preset of response.presets) {
                    if (preset.title === 'Default') {
                        this._presets[1].information = copy(preset.information);
                        break;
                    }
                }
                this._presets.push(...response.presets.filter((preset: IPCMessages.IPreset) => {
                    return preset.title !== 'Default';
                }));
            }
            this.getEnv({ session: this._sessionID }).then(() => {
                this._subjects.onShellChange.next(this._getPreset(this._selectedPresetTitle).information.shell);
            }).catch((error: Error) => {
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
        ElectronIpcService.request(new IPCMessages.ShellSaveRequest(request), IPCMessages.ShellSaveResponse).catch((error: Error) => {
            this._logger.error(`Fail to save preset settings in session ${request.session} due to error: ${error.message}`);
        });
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._saveSession({ session: this._sessionID, presetTitle: this._selectedPresetTitle });
            this._sessionID = session.getGuid();
            this.restoreSession({ session: this._sessionID }).catch((error: Error) => {
                this._logger.error(error.message);
            });
        }
    }

}

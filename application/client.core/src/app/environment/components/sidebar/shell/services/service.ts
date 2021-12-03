import { Observable, Subscription, Subject } from 'rxjs';
import { IPair } from '../../../../thirdparty/code/engine';
import { IEnvironment, INewInformation } from '../environment/component';
import { Session } from '../../../../controller/session/session';
import { copy } from '../../../../../../../../client.libs/chipmunk.client.toolkit/src/tools/tools.object';
import { IPreset } from '../../../../../../../../common/ipc/electron.ipc.messages';

import ElectronIpcService, { IPC } from '../../../../services/service.electron.ipc';
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

    private _presets: IPC.IPreset[] = [
        {
            custom: false,
            title: this.saveAs,
            information: {
                pwd: '',
                shell: '',
                env: [],
            },
        },
        {
            title: 'Default',
            custom: false,
            information: {
                pwd: '',
                shell: '',
                env: [],
            },
        },
    ];
    private _sessionID: string | undefined;
    private _shells: string[] = [];
    private _defaultInformation: INewInformation | undefined;
    private _selectedPresetTitle: string = this._presets[1].title;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellService');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _subjects: {
        onRestored: Subject<void>;
        onShellChange: Subject<string>;
    } = {
        onRestored: new Subject<void>(),
        onShellChange: new Subject<string>(),
    };

    constructor() {
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
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
        if (this._defaultInformation === undefined) {
            throw new Error(this._logger.error(`default information isn't inited`));
        }
        return this._defaultInformation;
    }

    public get presets(): IPC.IPreset[] {
        return this._presets.slice();
    }

    public set selectedPresetTitle(title: string) {
        this._selectedPresetTitle = title;
    }

    public get selectedPresetTitle(): string {
        return this._selectedPresetTitle;
    }

    public getObservable(): {
        onRestored: Observable<void>;
        onShellChange: Observable<string>;
    } {
        return {
            onRestored: this._subjects.onRestored.asObservable(),
            onShellChange: this._subjects.onShellChange.asObservable(),
        };
    }

    public resetSelectedPreset() {
        if (this._sessionID === undefined) {
            return;
        }
        this._getPreset(this._selectedPresetTitle).information = copy(this._defaultInformation);
        this.setPreset(this._sessionID).catch((error: Error) => {
            this._logger.error(error.message);
        });
        this._subjects.onShellChange.next(this.defaultInformation.shell);
    }

    public terminate(request: IPC.IShellProcessKillRequest, command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(
                new IPC.ShellProcessKillRequest(request),
                IPC.ShellProcessKillResponse,
            )
                .then((response: IPC.ShellProcessKillResponse) => {
                    if (response.error !== undefined) {
                        return reject(
                            new Error(
                                `Fail to terminate process "${command}" due error: ${response.error}`,
                            ),
                        );
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Fail to terminate process "${command}" due error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public getRunning(sessionID: string): Promise<IPC.ShellProcessListResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellProcessListResponse>(
                new IPC.ShellProcessListRequest({ session: sessionID }),
                IPC.ShellProcessListResponse,
            )
                .then(resolve)
                .catch((error: Error) => {
                    reject(new Error(`Fail to get running processes due error: ${error.message}`));
                });
        });
    }

    public getHistory(sessionID: string): Promise<IPC.ShellProcessHistoryGetResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellProcessHistoryGetResponse>(
                new IPC.ShellProcessHistoryGetRequest({ session: sessionID }),
                IPC.ShellProcessHistoryGetResponse,
            )
                .then(resolve)
                .catch((error: Error) => {
                    reject(
                        new Error(`Fail to get history of processes due error: ${error.message}`),
                    );
                });
        });
    }

    public setBundle(sessionID: string, bundle: IPC.IBundle) {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellProcessBundleSetResponse>(
                new IPC.ShellProcessBundleSetRequest({ session: sessionID, bundle: bundle }),
                IPC.ShellProcessBundleSetResponse,
            )
                .then((response: IPC.ShellProcessBundleSetResponse) => {
                    if (response.error !== undefined) {
                        reject(
                            new Error(
                                `Fail to save bundle of processes due error: ${response.error}`,
                            ),
                        );
                    } else {
                        resolve(response);
                    }
                })
                .catch((error: Error) => {
                    reject(
                        new Error(`Fail to save bundle of processes due error: ${error.message}`),
                    );
                });
        });
    }

    public removeBundles(sessionID: string, bundles: IPC.IBundle[]) {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellProcessBundleRemoveResponse>(
                new IPC.ShellProcessBundleRemoveRequest({ session: sessionID, bundles: bundles }),
                IPC.ShellProcessBundleRemoveResponse,
            )
                .then((response: IPC.ShellProcessBundleRemoveResponse) => {
                    if (response.error !== undefined) {
                        reject(
                            new Error(
                                `Fail to save bundles of processes due error: ${response.error}`,
                            ),
                        );
                    } else {
                        resolve(response);
                    }
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Fail to remove bundles of processes due error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public getEnv(request: IPC.IShellEnvRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellEnvResponse>(
                new IPC.ShellEnvRequest(request),
                IPC.ShellEnvResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        reject(
                            new Error(
                                `Failed to reqeust environment information due to Error: ${response.error}`,
                            ),
                        );
                    } else {
                        this._shells = response.shells;
                        this._defaultInformation = {
                            env: this._convertEnv(response.env),
                            shell: response.shell,
                            pwd: response.pwd,
                        };
                        if (
                            this._presets[1].information.pwd !== undefined &&
                            this._presets[1].information.pwd.trim() === ''
                        ) {
                            this._presets[1].information = copy(this._defaultInformation);
                            this.setPreset(request.session);
                        }
                        resolve();
                    }
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Failed to reqeust environment information due to Error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public setEnv(request: IPC.IShellSetEnvRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(
                new IPC.ShellSetEnvRequest({
                    pwd: request.pwd,
                    shell: request.shell,
                    session: request.session,
                    env: request.env,
                }),
                IPC.ShellSetEnvResponse,
            )
                .then((response: IPC.ShellSetEnvResponse) => {
                    if (response.error !== undefined) {
                        reject(
                            new Error(`Failed to set environment due to Error: ${response.error}`),
                        );
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
                })
                .catch((error: Error) => {
                    reject(new Error(`Failed to set environment due to Error: ${error.message}`));
                });
        });
    }

    public getDetails(request: IPC.IShellProcessDetailsRequest): Promise<IPC.IShellProcess> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellProcessDetailsResponse>(
                new IPC.ShellProcessDetailsRequest(request),
                IPC.ShellProcessDetailsResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        reject(
                            new Error(
                                `Failed to reqeust process details of due to Error: ${response.error}`,
                            ),
                        );
                    } else if (response.info === undefined) {
                        reject(
                            new Error(
                                this._logger.error(
                                    `ShellProcessDetailsResponse returns invalid data`,
                                ),
                            ),
                        );
                    } else {
                        resolve(response.info);
                    }
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Failed to send a process details reqeust due to Error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public clearRecent(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellRecentCommandsClearResponse>(
                new IPC.ShellRecentCommandsClearRequest(),
                IPC.ShellRecentCommandsClearResponse,
            )
                .then((response) => {
                    if (response.error) {
                        return reject(
                            new Error(`Fail to reset recent commands due error: ${response.error}`),
                        );
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Fail send request to reset recent commands due error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public runCommand(request: { session: string; command: string }): Promise<void> {
        return new Promise((resolve, reject) => {
            const preset: IPreset = this._getPreset(this._selectedPresetTitle);
            if (preset.information.pwd === undefined || preset.information.shell === undefined) {
                return reject(new Error(this._logger.error(`Fields pwd or shell aren't defined`)));
            }
            ElectronIpcService.request(
                new IPC.ShellProcessRunRequest({
                    session: request.session,
                    command: request.command,
                    pwd: preset.information.pwd,
                    shell: preset.information.shell,
                }),
                IPC.ShellProcessRunResponse,
            )
                .then((response: IPC.ShellProcessRunResponse) => {
                    if (response.error !== undefined) {
                        return reject(
                            new Error(
                                `Failed to run command ${request.command} due Error: ${response.error}`,
                            ),
                        );
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Failed to run command ${request.command} due Error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public loadRecentCommands(): Promise<IPair[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellRecentCommandsResponse>(
                new IPC.ShellRecentCommandsRequest(),
                IPC.ShellRecentCommandsResponse,
            )
                .then((response) => {
                    resolve(
                        response.commands.map((recent: string) => {
                            return {
                                id: '',
                                caption: ' ',
                                description: recent,
                                tcaption: ' ',
                                tdescription: recent,
                            };
                        }),
                    );
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Fail to get list of recent commands due error: ${error.message}`,
                        ),
                    );
                });
        });
    }

    public removeRecentCommand(request: IPC.IShellRecentCommandsRemove): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.send(new IPC.ShellRecentCommandsRemove(request))
                .then(() => {
                    resolve();
                })
                .catch((error: Error) => {
                    reject(
                        new Error(`Failed to remove recent command due error: ${error.message}`),
                    );
                });
        });
    }

    public setPwd(request: IPC.IShellPwdRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellPwdResponse>(
                new IPC.ShellPwdRequest(request),
                IPC.ShellPwdResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        return reject(
                            new Error(`Failed to set pwd due to the error: ${response.error}`),
                        );
                    }
                    if (this._sessionID === undefined) {
                        return reject(
                            new Error(
                                this._logger.error(
                                    `Cannot proccedd with "setPwd" because session guid is undefined`,
                                ),
                            ),
                        );
                    }
                    if (response.value.trim() !== '') {
                        this._getPreset(this._selectedPresetTitle).information.pwd = response.value;
                        this.setPreset(this._sessionID, { pwd: response.value }).catch(
                            (error: Error) => {
                                reject(
                                    `Failed to set pwd of preset due to the error ${error.message}`,
                                );
                            },
                        );
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    reject(new Error(`Failed to set pwd due to the error: ${error.message}`));
                });
        });
    }

    public setPreset(session: string, info?: IPresetInfo): Promise<void> {
        return new Promise((resolve, reject) => {
            const preset: IPreset = this._getPreset(this._selectedPresetTitle);
            ElectronIpcService.request(
                new IPC.ShellPresetSetRequest({
                    session: session,
                    preset:
                        info === undefined
                            ? preset
                            : { title: preset.title, custom: preset.custom, information: info },
                }),
                IPC.ShellPresetSetResponse,
            )
                .then((response: IPC.ShellPresetSetResponse) => {
                    resolve();
                })
                .catch((error: Error) => {
                    reject(new Error(`Failed to set preset due to the error: ${error.message}`));
                });
        });
    }

    public removePreset(request: IPC.IShellPresetRemoveRequest): Promise<void> {
        this._presets = this._presets.filter((preset: IPreset) => {
            return preset.title !== this._selectedPresetTitle;
        });
        this._selectedPresetTitle = this._presets[this._presets.length - 1].title;
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(
                new IPC.ShellPresetRemoveRequest({
                    session: request.session,
                    title: request.title,
                }),
                IPC.ShellPresetRemoveResponse,
            )
                .then((response: IPC.ShellPresetRemoveResponse) => {
                    resolve();
                })
                .catch((error: Error) => {
                    reject(new Error(`Failed to remove preset due to the error: ${error.message}`));
                });
        });
    }

    public restoreSession(request: IPC.IShellLoadRequest, outside: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellLoadResponse>(
                new IPC.ShellLoadRequest(request),
                IPC.ShellLoadResponse,
            )
                .then((response) => {
                    if (response.presetTitle.trim() === '') {
                        return resolve();
                    }
                    this._presets.forEach((preset: IPC.IPreset) => {
                        if (preset.title === response.presetTitle) {
                            this._selectedPresetTitle = preset.title;
                        }
                    });
                    if (!outside) {
                        this._subjects.onRestored.next();
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            `Fail to restore preset settings in session ${request.session} due to the error: ${error.message}`,
                        ),
                    );
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

    private _getPresets(session: string): Promise<IPC.IShellPresetGetResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.ShellPresetGetResponse>(
                new IPC.ShellPresetGetRequest({ session: session }),
                IPC.ShellPresetGetResponse,
            )
                .then((response) => {
                    resolve(response);
                })
                .catch((error: Error) => {
                    reject(new Error(`Failed to get presets due to the error: ${error.message}`));
                });
        });
    }

    private _init() {
        if (this._sessionID === undefined) {
            throw new Error(
                this._logger.error(`Cannot init service because session guid is undefined`),
            );
        }
        this._getPresets(this._sessionID)
            .then((response: IPC.IShellPresetGetResponse) => {
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
                    this._presets.push(
                        ...response.presets.filter((preset: IPC.IPreset) => {
                            return preset.title !== 'Default';
                        }),
                    );
                }
                this.getEnv({ session: this._sessionID })
                    .then(() => {
                        const shell = this._getPreset(this._selectedPresetTitle).information.shell;
                        shell !== undefined && this._subjects.onShellChange.next(shell);
                    })
                    .catch((error: Error) => {
                        this._logger.error(
                            `Failed to get environment information due to the error: ${error.message}`,
                        );
                    });
            })
            .catch((error: Error) => {
                this._logger.error(
                    `Failed to initialize service due to the error: ${error.message}`,
                );
            });
    }

    private _convertEnv(environment: { [key: string]: string }): IEnvironment[] {
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

    private _saveSession(request: IPC.IShellSaveRequest) {
        ElectronIpcService.request(new IPC.ShellSaveRequest(request), IPC.ShellSaveResponse).catch(
            (error: Error) => {
                this._logger.error(
                    `Fail to save preset settings in session ${request.session} due to error: ${error.message}`,
                );
            },
        );
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID !== undefined &&
                this._saveSession({
                    session: this._sessionID,
                    presetTitle: this._selectedPresetTitle,
                });
            this._sessionID = session.getGuid();
            this.restoreSession({ session: this._sessionID }).catch((error: Error) => {
                this._logger.error(error.message);
            });
        }
    }
}

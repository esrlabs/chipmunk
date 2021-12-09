import * as Toolkit from 'chipmunk.client.toolkit';

import { IService } from '../interfaces/interface.service';
import { IPC, Subscription } from './service.electron.ipc';
import { Session } from '../controller/session/session';
import { FilesList } from '../controller/controller.file.storage';
import { DialogsMultipleFilesActionComponent } from '../components/dialogs/multiplefiles/component';
import { CGuids } from '../states/state.default.sidebar.apps';
import { Storage } from '../controller/helpers/virtualstorage';
import { ENotificationType } from '../services.injectable/injectable.service.notifications';

import LayoutStateService from './standalone/service.layout.state';
import ServiceElectronIpc from './service.electron.ipc';
import TabsSessionsService, { ICustomTab } from './service.sessions.tabs';
import SidebarSessionsService from './service.sessions.sidebar';
import PopupsService from './standalone/service.popups';
import FileOptionsService from './service.file.options';
import MergeFilesService from './service.file.merge';
import ConcatFilesService from './service.file.concat';

export enum EActionType {
    concat = 'concat',
    merging = 'merging',
}

export interface IFileOpenerService {
    merge(files: IPC.IFile[] | FilesList): void;
    concat(files: IPC.IFile[] | FilesList): void;
    converFilesToIFiles(files: File[]): IPC.IFile[];
}

const CReopenContextMenuItemId = 'reopen_file_item';

export class FileOpenerService implements IService, IFileOpenerService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOpenerService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _used: boolean = false;

    constructor() {}

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.FileOpenDoneEvent = ServiceElectronIpc.subscribe(
                IPC.FileOpenDoneEvent,
                this._onFileOpenDoneEvent.bind(this),
            );
            this._subscriptions.FileOpenInprogressEvent = ServiceElectronIpc.subscribe(
                IPC.FileOpenInprogressEvent,
                this._onFileOpenInprogressEvent.bind(this),
            );
            this._subscriptions.CLIActionOpenFileRequest = ServiceElectronIpc.subscribe(
                IPC.CLIActionOpenFileRequest,
                this._onCLIActionOpenFileRequest.bind(this),
            );
            this._subscriptions.CLIActionMergeFilesRequest = ServiceElectronIpc.subscribe(
                IPC.CLIActionMergeFilesRequest,
                this._onCLIActionMergeFilesRequest.bind(this),
            );
            this._subscriptions.CLIActionConcatFilesRequest = ServiceElectronIpc.subscribe(
                IPC.CLIActionConcatFilesRequest,
                this._onCLIActionConcatFilesRequest.bind(this),
            );
            this._subscriptions.FilesOpenEvent = ServiceElectronIpc.subscribe(
                IPC.FilesOpenEvent,
                this._onFilesOpenEvent.bind(this),
            );
            resolve();
        });
    }

    public getName(): string {
        return 'FileOpenerService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    private _filterChecked(fileList: IPC.IFile[]): IPC.IFile[] {
        return fileList.filter((file: IPC.IFile) => file.checked === true);
    }

    public getPathsFromFiles(files: File[]): string[] {
        return files.map((file: File) => {
            if (typeof (file as any).path !== 'string') {
                this._logger.error(
                    `file {File} doesn't have property "path": ${JSON.stringify(file)}`,
                );
                if (typeof (file as any).webkitRelativePath !== 'string') {
                    this._logger.error(
                        `file {File} doesn't have property "webkitRelativePath" too`,
                    );
                    return (file as any).webkitRelativePath;
                } else {
                    return '';
                }
            } else {
                return (file as any).path;
            }
        });
    }

    public converFilesToIFiles(files: File[]): IPC.IFile[] {
        return files.map((file: File) => {
            return {
                lastModified: file.lastModified,
                lastModifiedDate: new Date(file.lastModified),
                name: file.name,
                path: (file as any).path,
                size: file.size,
                type: file.type,
                hasParser: false,
                isHidden: false,
                checked: false,
                disabled: false,
                features: {
                    merge: false,
                    concat: false,
                },
            };
        });
    }

    public open(paths: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (paths.length === 0) {
                return resolve();
            }
            this.getDetailedFileList(paths)
                .then((list: IPC.IFile[]) => {
                    this._setSessionNewSession()
                        .then((session: Session) => {
                            TabsSessionsService.setActive(session.getGuid());
                            if (list.length === 0) {
                                return resolve();
                            }
                            if (list.length === 1) {
                                // Single file
                                ServiceElectronIpc.request<IPC.FileReadResponse>(
                                    new IPC.FileOpenRequest({
                                        file: list[0].path,
                                        session: session.getGuid(),
                                    }),
                                    IPC.FileOpenResponse,
                                )
                                    .then((response) => {
                                        if (response.error !== undefined) {
                                            return reject(
                                                new Error(
                                                    this._logger.error(
                                                        `Fail open file/folder "${paths[0]}" due error: ${response.error}`,
                                                    ),
                                                ),
                                            );
                                        }
                                        resolve();
                                    })
                                    .catch((error: Error) => {
                                        return reject(
                                            new Error(
                                                this._logger.error(
                                                    `Fail open file/folder "${paths[0]}" due error: ${error.message}`,
                                                ),
                                            ),
                                        );
                                    });
                            } else {
                                // Multiple files
                                // Select way: merge or concat
                                const fileList: FilesList = new FilesList(list);
                                const features: {
                                    merge: boolean;
                                    concat: boolean;
                                } = {
                                    merge:
                                        fileList.getFiles().find((f) => !f.features.merge) ===
                                        undefined
                                            ? true
                                            : false,
                                    concat:
                                        fileList.getFiles().find((f) => !f.features.concat) ===
                                        undefined
                                            ? true
                                            : false,
                                };
                                const buttons = [
                                    {
                                        caption: 'Open each',
                                        handler: this.openEach.bind(this, fileList),
                                    },
                                ];
                                if (features.concat) {
                                    buttons.unshift({
                                        caption: 'Concat',
                                        handler: this.concat.bind(this, fileList),
                                    });
                                }
                                if (features.merge) {
                                    buttons.unshift({
                                        caption: 'Merge',
                                        handler: this.merge.bind(this, fileList),
                                    });
                                }
                                PopupsService.add({
                                    id: 'opening-file-dialog',
                                    caption: `Opening files`,
                                    component: {
                                        factory: DialogsMultipleFilesActionComponent,
                                        inputs: {
                                            fileList: fileList,
                                        },
                                    },
                                    buttons: buttons,
                                });
                                resolve();
                            }
                        })
                        .catch((error: Error) => {
                            return reject(
                                new Error(
                                    this._logger.error(
                                        `Fail open file "${paths[0]}" due error: ${error.message}`,
                                    ),
                                ),
                            );
                        });
                })
                .catch((error: Error) => {
                    return reject(
                        new Error(
                            this._logger.error(
                                `Cannot continue with opening file, because fail to prepare session due error: ${error.message}`,
                            ),
                        ),
                    );
                });
        });
    }

    public openFileByName(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._setSessionNewSession()
                .then((session: Session) => {
                    TabsSessionsService.setActive(session.getGuid());
                    ServiceElectronIpc.request<IPC.FileOpenResponse>(
                        new IPC.FileOpenRequest({
                            file: file,
                            session: session.getGuid(),
                        }),
                        IPC.FileOpenResponse,
                    )
                        .then((response) => {
                            if (response.error !== undefined) {
                                this._logger.error(
                                    `Fail open file "${file}" due error: ${response.error}`,
                                );
                                // TODO: add notification here
                                return reject(new Error(response.error));
                            }
                            resolve();
                        })
                        .catch((error: Error) => {
                            this._logger.error(
                                `Fail open file "${file}" due error: ${error.message}`,
                            );
                            // TODO: add notification here
                            reject(error);
                        });
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Cannot continue with opening file, because fail to prepare session due error: ${error.message}`,
                    );
                });
        });
    }

    public merge(list: IPC.IFile[] | FilesList, session?: Session) {
        const checked =
            list instanceof Array
                ? this._filterChecked(list)
                : this._filterChecked(list.getFiles());
        if (checked.length <= 0) {
            return;
        }
        this._open(checked, EActionType.merging, session);
    }

    public concat(list: IPC.IFile[] | FilesList, session?: Session) {
        const checked =
            list instanceof Array
                ? this._filterChecked(list)
                : this._filterChecked(list.getFiles());
        if (checked.length <= 0) {
            return;
        }
        this._open(checked, EActionType.concat, session);
    }

    public openEach(list: IPC.IFile[] | FilesList) {
        const checked: IPC.IFile[] =
            list instanceof Array
                ? this._filterChecked(list)
                : this._filterChecked(list.getFiles());
        if (checked.length <= 0) {
            return;
        }
        const openFile = (index: number) => {
            if (index >= checked.length) {
                return;
            }
            this.openFileByName(checked[index].path)
                .then(() => {
                    openFile(++index);
                })
                .catch((error: Error) => {
                    TabsSessionsService.getPluginAPI(undefined).addNotification({
                        caption: `Fail to open file`,
                        message: `Fail to open file ${checked[index].path} due error ${error.message}`,
                        options: {
                            type: ENotificationType.error,
                        },
                    });
                    openFile(++index);
                });
        };
        openFile(0);
    }

    public getDetailedFileList(paths: string[]): Promise<IPC.IFile[]> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request<IPC.FileListResponse>(
                new IPC.FileListRequest({
                    files: paths,
                }),
                IPC.FileListResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        return reject(
                            new Error(
                                this._logger.error(`Fail check paths due error: ${response.error}`),
                            ),
                        );
                    }
                    resolve(response.files);
                })
                .catch((error: Error) => {
                    return reject(
                        new Error(
                            this._logger.error(
                                `Fail to send IPC message to chech paths: ${error.message}`,
                            ),
                        ),
                    );
                });
        });
    }

    private _open(files: IPC.IFile[], action: EActionType, session?: Session) {
        const active = session !== undefined ? session : TabsSessionsService.getActive();
        if (active === undefined) {
            return;
        }
        const guid: string = CGuids[action];
        const exist: boolean = SidebarSessionsService.has(guid);
        switch (action) {
            case EActionType.merging:
                MergeFilesService.add(files, active.getGuid());
                break;
            case EActionType.concat:
                ConcatFilesService.add(files, active.getGuid());
                break;
        }
        // Add or activate tab on sidebar
        if (!exist) {
            SidebarSessionsService.addByGuid(guid);
        } else {
            SidebarSessionsService.setActive(guid);
        }
        LayoutStateService.sidebarMax();
    }

    private _setReopenCallback(
        session: Session,
        file: string,
        stream: IPC.IStreamSourceNew | undefined,
        options: any,
    ) {
        const menuService = session.getTabTitleContextMenuService();
        if (menuService === undefined) {
            return;
        }
        if (
            stream === undefined ||
            stream.meta === undefined ||
            !FileOptionsService.hasOptions(stream.meta)
        ) {
            menuService.update(
                {
                    id: CReopenContextMenuItemId,
                    caption: 'Reopen File',
                    disabled: true,
                    handler: () => {},
                },
                'unshift',
            );
            return;
        }
        const storage: Storage<any> = new Storage<any>(options);
        const opener = FileOptionsService.getReopenOptionsCallback<any>(
            session,
            stream.meta,
            file,
            storage,
        );
        if (opener !== undefined) {
            menuService.update(
                {
                    id: CReopenContextMenuItemId,
                    caption: 'Reopen File',
                    disabled: false,
                    handler: opener,
                },
                'unshift',
            );
        } else {
            menuService.update(
                {
                    id: CReopenContextMenuItemId,
                    caption: 'Reopen File',
                    disabled: true,
                    handler: () => {},
                },
                'unshift',
            );
        }
    }

    private _setSessionNewSession(cli: boolean = false): Promise<Session> {
        return new Promise((resolve, reject) => {
            // Check active session before
            const active: Session | undefined = TabsSessionsService.getEmpty();
            if (
                active !== undefined &&
                active.getStreamOutput().getRowsCount() === 0 &&
                (!cli || !this._used)
            ) {
                // Active session is empty, we can use it
                this._used = true;
                return resolve(active);
            }
            // Active session has content, create new one
            TabsSessionsService.add()
                .then((session: Session | ICustomTab) => {
                    if (session instanceof Session) {
                        resolve(session);
                    } else {
                        reject(
                            new Error(this._logger.error(`ICustomTab is created instead Session`)),
                        );
                    }
                })
                .catch((addSessionErr: Error) => {
                    reject(addSessionErr);
                });
        });
    }

    private _onFileOpenDoneEvent(msg: IPC.FileOpenDoneEvent) {
        const session: Session | Error = TabsSessionsService.getSessionController(msg.session);
        if (session instanceof Error) {
            this._logger.warn(`Fail to find a session "${msg.session}"`);
            return;
        }
        this._setReopenCallback(session, msg.file, msg.stream, msg.options);
    }

    private _onFileOpenInprogressEvent(msg: IPC.FileOpenInprogressEvent) {
        const session: Session | Error = TabsSessionsService.getSessionController(msg.session);
        if (session instanceof Error) {
            this._logger.warn(`Fail to find a session "${msg.session}"`);
            return;
        }
        const menuService = session.getTabTitleContextMenuService();
        if (menuService === undefined) {
            return;
        }
        menuService.unshift({
            id: CReopenContextMenuItemId + 'delimiter',
        });
        menuService.unshift({
            id: CReopenContextMenuItemId,
            caption: 'Reopen File (indexing...)',
            disabled: true,
            handler: () => {},
        });
    }

    private _onCLIActionOpenFileRequest(
        msg: IPC.CLIActionOpenFileRequest,
        response: (message: IPC.TMessage) => Promise<void>,
    ) {
        this.openFileByName(msg.file)
            .then(() => {
                response(new IPC.CLIActionOpenFileResponse({})).catch((resErr: Error) => {
                    this._logger.warn(`Fail send response due error: ${resErr.message}`);
                });
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail to open file "${msg.file}" due error: ${err.message}`);
                response(new IPC.CLIActionOpenFileResponse({ error: err.message })).catch(
                    (resErr: Error) => {
                        this._logger.warn(`Fail send response due error: ${resErr.message}`);
                    },
                );
            });
    }

    private _onCLIActionMergeFilesRequest(
        msg: IPC.CLIActionMergeFilesRequest,
        response: (message: IPC.TMessage) => Promise<void>,
    ) {
        this.getDetailedFileList(msg.files)
            .then((list: IPC.IFile[]) => {
                if (list.length === 0) {
                    response(
                        new IPC.CLIActionMergeFilesResponse({
                            error: `File list is empty`,
                        }),
                    ).catch((resErr: Error) => {
                        this._logger.warn(`Fail send response due error: ${resErr.message}`);
                    });
                    return;
                }
                this._setSessionNewSession(true)
                    .then((session: Session) => {
                        TabsSessionsService.setActive(session.getGuid());
                        this.merge(
                            list.map((file) => {
                                file.checked = true;
                                return file;
                            }),
                            session,
                        );
                        response(new IPC.CLIActionMergeFilesResponse({})).catch((resErr: Error) => {
                            this._logger.warn(`Fail send response due error: ${resErr.message}`);
                        });
                    })
                    .catch((err: Error) => {
                        return response(
                            new IPC.CLIActionMergeFilesResponse({
                                error: `Fail to create session: ${err.message}`,
                            }),
                        ).catch((resErr: Error) => {
                            this._logger.warn(`Fail to create session due error: ${err.message}`);
                        });
                    });
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail to merge files due error: ${err.message}`);
                response(new IPC.CLIActionMergeFilesResponse({ error: err.message })).catch(
                    (resErr: Error) => {
                        this._logger.warn(`Fail send response due error: ${resErr.message}`);
                    },
                );
            });
    }

    private _onCLIActionConcatFilesRequest(
        msg: IPC.CLIActionConcatFilesRequest,
        response: (message: IPC.TMessage) => Promise<void>,
    ) {
        this.getDetailedFileList(msg.files)
            .then((list: IPC.IFile[]) => {
                if (list.length === 0) {
                    response(
                        new IPC.CLIActionConcatFilesResponse({
                            error: `File list is empty`,
                        }),
                    ).catch((resErr: Error) => {
                        this._logger.warn(`Fail send response due error: ${resErr.message}`);
                    });
                    return;
                }
                this._setSessionNewSession(true)
                    .then((session: Session) => {
                        TabsSessionsService.setActive(session.getGuid());
                        this.concat(
                            list.map((file) => {
                                file.checked = true;
                                return file;
                            }),
                            session,
                        );
                        response(new IPC.CLIActionConcatFilesResponse({})).catch(
                            (resErr: Error) => {
                                this._logger.warn(
                                    `Fail send response due error: ${resErr.message}`,
                                );
                            },
                        );
                    })
                    .catch((err: Error) => {
                        return response(
                            new IPC.CLIActionConcatFilesResponse({
                                error: `Fail to create session: ${err.message}`,
                            }),
                        ).catch((resErr: Error) => {
                            this._logger.warn(`Fail to create session due error: ${err.message}`);
                        });
                    });
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail to merge files due error: ${err.message}`);
                response(new IPC.CLIActionConcatFilesResponse({ error: err.message })).catch(
                    (resErr: Error) => {
                        this._logger.warn(`Fail send response due error: ${resErr.message}`);
                    },
                );
            });
    }

    private _onFilesOpenEvent(msg: IPC.FilesOpenEvent) {
        this.open(msg.files);
    }
}

export default new FileOpenerService();

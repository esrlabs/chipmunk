import * as Toolkit from 'chipmunk.client.toolkit';

import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron.ipc';
import { Session } from '../controller/session/session';
import { FilesList } from '../controller/controller.file.storage';
import { DialogsMultipleFilesActionComponent } from '../components/dialogs/multiplefiles/component';
import { CGuids } from '../states/state.default.sidebar.apps';
import { Storage } from '../controller/helpers/virtualstorage';

import LayoutStateService from './standalone/service.layout.state';
import ServiceElectronIpc from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
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
    merge: (files: IPCMessages.IFile[] | FilesList) => void;
    concat: (files: IPCMessages.IFile[] | FilesList) => void;
}

const CReopenContextMenuItemId = 'reopen_file_item';

export class FileOpenerService implements IService, IFileOpenerService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOpenerService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _used: boolean = false;

    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.FileOpenDoneEvent = ServiceElectronIpc.subscribe(IPCMessages.FileOpenDoneEvent, this._onFileOpenDoneEvent.bind(this));
            this._subscriptions.FileOpenInprogressEvent = ServiceElectronIpc.subscribe(IPCMessages.FileOpenInprogressEvent, this._onFileOpenInprogressEvent.bind(this));
            this._subscriptions.CLIActionOpenFileRequest = ServiceElectronIpc.subscribe(IPCMessages.CLIActionOpenFileRequest, this._onCLIActionOpenFileRequest.bind(this));
            this._subscriptions.CLIActionMergeFilesRequest = ServiceElectronIpc.subscribe(IPCMessages.CLIActionMergeFilesRequest, this._onCLIActionMergeFilesRequest.bind(this));
            this._subscriptions.CLIActionConcatFilesRequest = ServiceElectronIpc.subscribe(IPCMessages.CLIActionConcatFilesRequest, this._onCLIActionConcatFilesRequest.bind(this));
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

    private _filterChecked(fileList: IPCMessages.IFile[]): IPCMessages.IFile[] {
        return fileList;
        // return fileList.filter((file: IPCMessages.IFile) => file.checked === true);
    }

    public open(files: IPCMessages.IFile[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (files.length === 0) {
                return resolve();
            }
            this._getDetailedFileList(files.map((file: IPCMessages.IFile) => file.path)).then((list: IPCMessages.IFile[]) => {
                this._setSessionNewSession().then((session: Session) => {
                    TabsSessionsService.setActive(session.getGuid());
                    if (list.length === 0) {
                        return resolve();
                    }
                    if (list.length === 1) {
                        // Single file
                        ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                            file: list[0].path,
                            session: session.getGuid(),
                        }), IPCMessages.FileOpenResponse).then((openResponse: IPCMessages.FileReadResponse) => {
                            if (openResponse.error !== undefined) {
                                return reject(new Error(this._logger.error(`Fail open file/folder "${files[0].path}" due error: ${openResponse.error}`)));
                            }
                            resolve();
                        }).catch((error: Error) => {
                            return reject(new Error(this._logger.error(`Fail open file/folder "${files[0].path}" due error: ${error.message}`)));
                    });
                    } else {
                        // Multiple files
                        // Select way: merge or concat
                        const fileList: FilesList = new FilesList(list);
                        const guid: string = PopupsService.add({
                            id: 'opening-file-dialog',
                            caption: `Opening files`,
                            component: {
                                factory: DialogsMultipleFilesActionComponent,
                                inputs: {
                                    fileList: fileList,
                                }
                            },
                            buttons: [
                                { caption: 'Merge', handler: this.merge.bind(this, fileList), },
                                { caption: 'Concat', handler: this.concat.bind(this, fileList), },
                            ],
                        });
                        resolve();
                    }
                }).catch((error: Error) => {
                    return reject(new Error(this._logger.error(`Fail open file "${files[0].path}" due error: ${error.message}`)));
                });
            }).catch((error: Error) => {
                return reject(new Error(this._logger.error(`Cannot continue with opening file, because fail to prepare session due error: ${error.message}`)));
            });
        });
    }

    public openFileByName(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._setSessionNewSession().then((session: Session) => {
                TabsSessionsService.setActive(session.getGuid());
                ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                    file: file,
                    session: session.getGuid(),
                }), IPCMessages.FileOpenResponse).then((response: IPCMessages.FileOpenResponse) => {
                    if (response.error !== undefined) {
                        this._logger.error(`Fail open file "${file}" due error: ${response.error}`);
                        // TODO: add notification here
                        return reject(new Error(response.error));
                    }
                    resolve();
                }).catch((error: Error) => {
                    this._logger.error(`Fail open file "${file}" due error: ${error.message}`);
                    // TODO: add notification here
                    reject(error);
                });
            }).catch((error: Error) => {
                this._logger.error(`Cannot continue with opening file, because fail to prepare session due error: ${error.message}`);
            });
        });
    }

    public merge(list: IPCMessages.IFile[] | FilesList, session?: Session) {
        const checked = list instanceof Array ? this._filterChecked(list) : this._filterChecked(list.getFiles());
        if (checked.length <= 0) {
            return;
        }
        this._open(checked, EActionType.merging, session);
    }

    public concat(list: IPCMessages.IFile[] | FilesList, session?: Session) {
        const checked = list instanceof Array ? this._filterChecked(list) : this._filterChecked(list.getFiles());
        if (checked.length <= 0) {
            return;
        }
        this._open(checked, EActionType.concat, session);
    }

    private _getDetailedFileList(paths: string[]): Promise<IPCMessages.IFile[]> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPCMessages.FileListRequest({
                files: paths,
                session: TabsSessionsService.getActive().getGuid(),
            }), IPCMessages.FileListResponse).then((response: IPCMessages.FileListResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.error(`Fail check paths due error: ${response.error}`)));
                }
                resolve(response.files);
            }).catch((error: Error) => {
                return reject(new Error(this._logger.error(`Fail to send IPC message to chech paths: ${error.message}`)));
            });
        });
    }

    private _open(files: IPCMessages.IFile[], action: EActionType, session?: Session) {
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
        stream: IPCMessages.IStreamSourceNew | undefined,
        options: any
    ) {
        if (stream === undefined || !FileOptionsService.hasOptions(stream.meta)) {
            session.getTabTitleContextMenuService().update({
                id: CReopenContextMenuItemId,
                caption: 'Reopen File',
                disabled: true,
                handler: () => {},
            }, 'unshift');
            return;
        }
        const storage: Storage<any> = new Storage<any>(options);
        const opener = FileOptionsService.getReopenOptionsCallback<any>(session, stream.meta, file, storage);
        if (opener !== undefined) {
            session.getTabTitleContextMenuService().update({
                id: CReopenContextMenuItemId,
                caption: 'Reopen File',
                disabled: false,
                handler: opener,
            }, 'unshift');
        } else {
            session.getTabTitleContextMenuService().update({
                id: CReopenContextMenuItemId,
                caption: 'Reopen File',
                disabled: true,
                handler: () => {},
            }, 'unshift');
        }
    }

    private _setSessionNewSession(cli: boolean = false): Promise<Session> {
        return new Promise((resolve, reject) => {
            // Check active session before
            const active: Session = TabsSessionsService.getEmpty();
            if (active !== undefined && active.getStreamOutput().getRowsCount() === 0 && (!cli || !this._used)) {
                // Active session is empty, we can use it
                this._used = true;
                return resolve(active);
            }
            // Active session has content, create new one
            TabsSessionsService.add().then((session: Session) => {
                resolve(session);
            }).catch((addSessionErr: Error) => {
                reject(addSessionErr);
            });
        });
    }

    private _onFileOpenDoneEvent(msg: IPCMessages.FileOpenDoneEvent) {
        const session: Session | Error = TabsSessionsService.getSessionController(msg.session);
        if (session instanceof Error) {
            this._logger.warn(`Fail to find a session "${msg.session}"`);
            return;
        }
        this._setReopenCallback(session, msg.file, msg.stream, msg.options);
    }

    private _onFileOpenInprogressEvent(msg: IPCMessages.FileOpenInprogressEvent) {
        const session: Session | Error = TabsSessionsService.getSessionController(msg.session);
        if (session instanceof Error) {
            this._logger.warn(`Fail to find a session "${msg.session}"`);
            return;
        }
        session.getTabTitleContextMenuService().unshift({
            id: CReopenContextMenuItemId + 'delimiter',
        });
        session.getTabTitleContextMenuService().unshift({
            id: CReopenContextMenuItemId,
            caption: 'Reopen File (indexing...)',
            disabled: true,
            handler: opener,
        });
    }

    private _onCLIActionOpenFileRequest(msg: IPCMessages.CLIActionOpenFileRequest, response: (message: IPCMessages.TMessage) => Promise<void>) {
        this.openFileByName(msg.file).then(() => {
            response(new IPCMessages.CLIActionOpenFileResponse({})).catch((resErr: Error) => {
                this._logger.warn(`Fail send response due error: ${resErr.message}`);
            });
        }).catch((err: Error) => {
            this._logger.warn(`Fail to open file "${msg.file}" due error: ${err.message}`);
            response(new IPCMessages.CLIActionOpenFileResponse({ error: err.message})).catch((resErr: Error) => {
                this._logger.warn(`Fail send response due error: ${resErr.message}`);
            });
        });
    }

    private _onCLIActionMergeFilesRequest(msg: IPCMessages.CLIActionMergeFilesRequest, response: (message: IPCMessages.TMessage) => Promise<void>) {
        this._getDetailedFileList(msg.files).then((list: IPCMessages.IFile[]) => {
            if (list.length === 0) {
                return response(new IPCMessages.CLIActionMergeFilesResponse({ error: `File list is empty`})).catch((resErr: Error) => {
                    this._logger.warn(`Fail send response due error: ${resErr.message}`);
                });
            }
            this._setSessionNewSession(true).then((session: Session) => {
                TabsSessionsService.setActive(session.getGuid());
                this.merge(list.map((file) => {
                    // file.checked = true;
                    return file;
                }), session);
                response(new IPCMessages.CLIActionMergeFilesResponse({ })).catch((resErr: Error) => {
                    this._logger.warn(`Fail send response due error: ${resErr.message}`);
                });
            }).catch((err: Error) => {
                return response(new IPCMessages.CLIActionMergeFilesResponse({ error: `Fail to create session: ${err.message}`})).catch((resErr: Error) => {
                    this._logger.warn(`Fail to create session due error: ${err.message}`);
                });
            });
        }).catch((err: Error) => {
            this._logger.warn(`Fail to merge files due error: ${err.message}`);
            response(new IPCMessages.CLIActionMergeFilesResponse({ error: err.message})).catch((resErr: Error) => {
                this._logger.warn(`Fail send response due error: ${resErr.message}`);
            });
        });
    }

    private _onCLIActionConcatFilesRequest(msg: IPCMessages.CLIActionConcatFilesRequest, response: (message: IPCMessages.TMessage) => Promise<void>) {
        this._getDetailedFileList(msg.files).then((list: IPCMessages.IFile[]) => {
            if (list.length === 0) {
                return response(new IPCMessages.CLIActionConcatFilesResponse({ error: `File list is empty`})).catch((resErr: Error) => {
                    this._logger.warn(`Fail send response due error: ${resErr.message}`);
                });
            }
            this._setSessionNewSession(true).then((session: Session) => {
                TabsSessionsService.setActive(session.getGuid());
                this.concat(list.map((file) => {
                    // file.checked = true;
                    return file;
                }), session);
                response(new IPCMessages.CLIActionConcatFilesResponse({ })).catch((resErr: Error) => {
                    this._logger.warn(`Fail send response due error: ${resErr.message}`);
                });
            }).catch((err: Error) => {
                return response(new IPCMessages.CLIActionConcatFilesResponse({ error: `Fail to create session: ${err.message}`})).catch((resErr: Error) => {
                    this._logger.warn(`Fail to create session due error: ${err.message}`);
                });
            });
        }).catch((err: Error) => {
            this._logger.warn(`Fail to merge files due error: ${err.message}`);
            response(new IPCMessages.CLIActionConcatFilesResponse({ error: err.message})).catch((resErr: Error) => {
                this._logger.warn(`Fail send response due error: ${resErr.message}`);
            });
        });
    }

}

export default (new FileOpenerService());

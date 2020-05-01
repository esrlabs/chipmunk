import * as Toolkit from 'chipmunk.client.toolkit';

import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import { IPCMessages, Subscription } from './service.electron.ipc';
import { ControllerSessionTab } from '../controller/controller.session.tab';
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

export interface IFile {
    lastModified: number;
    lastModifiedDate: Date;
    name: string;
    path: string;
    size: number;
    type: string;
}

export interface IFileOpenerService {
    merge: (files: IFile[]) => void;
    concat: (files: IFile[]) => void;
}

const CReopenContextMenuItemId = 'reopen_file_item';

export class FileOpenerService implements IService, IFileOpenerService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOpenerService');
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.FileOpenDoneEvent = ServiceElectronIpc.subscribe(IPCMessages.FileOpenDoneEvent, this._onFileOpenDoneEvent.bind(this));
            this._subscriptions.FileOpenInprogressEvent = ServiceElectronIpc.subscribe(IPCMessages.FileOpenInprogressEvent, this._onFileOpenInprogressEvent.bind(this));
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

    public open(files: IFile[]) {
        if (files.length === 0) {
            return;
        }
        if (files.length === 0) {
            return;
        }
        this._setSessionForFile().then((session: ControllerSessionTab) => {
            TabsSessionsService.setActive(session.getGuid());
            if (files.length === 1) {
                // Single file
                ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                    file: files[0].path,
                    session: session.getGuid(),
                }), IPCMessages.FileOpenResponse).then((response: IPCMessages.FileReadResponse) => {
                    if (response.error !== undefined) {
                        this._logger.error(`Fail open file "${files[0].path}" due error: ${response.error}`);
                        // TODO: add notification here
                        return;
                    }
                }).catch((error: Error) => {
                    this._logger.error(`Fail open file "${files[0].path}" due error: ${error.message}`);
                    // TODO: add notification here
                });
            } else {
                // Multiple files
                // Select way: merge or concat
                PopupsService.add({
                    id: 'opening-file-dialog',
                    caption: `Opening files`,
                    component: {
                        factory: DialogsMultipleFilesActionComponent,
                        inputs: {
                            files: files
                        }
                    },
                    buttons: [
                        { caption: 'Merge', handler: this.merge.bind(this, files), },
                        { caption: 'Concat', handler: this.concat.bind(this, files), },
                    ],
                });
            }
        }).catch((error: Error) => {
            this._logger.error(`Cannot continue with opening file, because fail to prepare session due error: ${error.message}`);
        });
    }

    public openFileByName(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._setSessionForFile().then((session: ControllerSessionTab) => {
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

    public merge(files: IFile[]) {
        this._open(files, EActionType.merging);
    }

    public concat(files: IFile[]) {
        this._open(files, EActionType.concat);
    }

    private _open(files: IFile[], action: EActionType) {
        const active = TabsSessionsService.getActive();
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
        session: ControllerSessionTab,
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

    private _setSessionForFile(): Promise<ControllerSessionTab> {
        return new Promise((resolve, reject) => {
            // Check active session before
            const active: ControllerSessionTab = TabsSessionsService.getEmpty();
            if (active !== undefined && active.getSessionStream().getOutputStream().getRowsCount() === 0) {
                // Active session is empty, we can use it
                return resolve(active);
            }
            // Active session has content, create new one
            TabsSessionsService.add().then((session: ControllerSessionTab) => {
                resolve(session);
            }).catch((addSessionErr: Error) => {
                reject(addSessionErr);
            });
        });
    }

    private _onFileOpenDoneEvent(msg: IPCMessages.FileOpenDoneEvent) {
        const session: ControllerSessionTab | Error = TabsSessionsService.getSessionController(msg.session);
        if (session instanceof Error) {
            this._logger.warn(`Fail to find a session "${msg.session}"`);
            return;
        }
        this._setReopenCallback(session, msg.file, msg.stream, msg.options);
    }

    private _onFileOpenInprogressEvent(msg: IPCMessages.FileOpenInprogressEvent) {
        const session: ControllerSessionTab | Error = TabsSessionsService.getSessionController(msg.session);
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
}

export default (new FileOpenerService());

import * as Toolkit from 'chipmunk.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import SidebarSessionsService from './service.sessions.sidebar';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import LayoutStateService from './standalone/service.layout.state';
import { DialogsMultipleFilesActionComponent } from '../components/dialogs/multiplefiles/component';
import PopupsService from './standalone/service.popups';
import FileOptionsService from './service.file.options';
import { CGuids } from '../states/state.default.sidebar.apps';
import { Storage } from '../controller/helpers/virtualstorage';

export enum EActionType {
    concat = 'concat',
    merging = 'merging',
}

export const CSubjects = {
    [CGuids.merging]: { subject: 'onFilesToBeMerged' },
    [CGuids.concat]: { subject: 'onFilesToBeConcat' },
};

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
    getObservable: () => {
        onFilesToBeMerged: Observable<IFile[]>,
        onFilesToBeConcat: Observable<IFile[]>,
    };
    getPendingFiles: () => IFile[];
    dropPendingFiles: () => void;
}

const CReopenContextMenuItemId = 'reopen_file_item';

export class FileOpenerService implements IService, IFileOpenerService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOpenerService');
    private _pending: IFile[] = [];
    private _subjects = {
        onFilesToBeMerged: new Subject<IFile[]>(),
        onFilesToBeConcat: new Subject<IFile[]>(),
    };

    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'FileOpenerService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
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
        this._setSessionForFile().then(() => {
            if (files.length === 1) {
                // Single file
                ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                    file: files[0].path,
                    session: TabsSessionsService.getActive().getGuid(),
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
                // Stored panding files
                this._pending = files;
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
                session.getTabTitleContextMenuService().unshift({
                    id: CReopenContextMenuItemId + 'delimiter',
                });
                session.getTabTitleContextMenuService().unshift({
                    id: CReopenContextMenuItemId,
                    caption: 'Reopen File (indexing...)',
                    disabled: true,
                    handler: opener,
                });
                ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                    file: file,
                    session: TabsSessionsService.getActive().getGuid(),
                }), IPCMessages.FileOpenResponse).then((response: IPCMessages.FileOpenResponse) => {
                    if (response.error !== undefined) {
                        this._logger.error(`Fail open file "${file}" due error: ${response.error}`);
                        session.getTabTitleContextMenuService().update({
                            id: CReopenContextMenuItemId,
                            caption: 'Reopen File',
                            disabled: true,
                            handler: opener,
                        });
                        // TODO: add notification here
                        return reject(new Error(response.error));
                    }
                    this._setReopenCallback(session, file, response.stream, response.options);
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

    public getObservable(): {
        onFilesToBeMerged: Observable<IFile[]>,
        onFilesToBeConcat: Observable<IFile[]>,
    } {
        return {
            onFilesToBeMerged: this._subjects.onFilesToBeMerged.asObservable(),
            onFilesToBeConcat: this._subjects.onFilesToBeConcat.asObservable(),
        };
    }

    public getPendingFiles(): IFile[] {
        const pending: IFile[] = this._pending.slice();
        this._pending = [];
        return pending;
    }

    public dropPendingFiles() {
        this._pending = [];
    }

    private _open(files: IFile[], action: EActionType) {
        // Stored panding files
        this._pending = files;
        const guid: string = CGuids[action];
        const exist: boolean = SidebarSessionsService.has(guid);
        // Show sidebar
        LayoutStateService.sidebarMax();
        // Add or activate tab on sidebar
        if (!exist) {
            SidebarSessionsService.addByGuid(guid);
        } else {
            SidebarSessionsService.setActive(guid);
        }
        // Trigger event
        this._subjects[CSubjects[guid].subject].next(this._pending.slice());
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
            });
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
            });
        } else {
            session.getTabTitleContextMenuService().update({
                id: CReopenContextMenuItemId,
                caption: 'Reopen File',
                disabled: true,
                handler: () => {},
            });
        }
    }

    private _setSessionForFile(): Promise<ControllerSessionTab> {
        return new Promise((resolve, reject) => {
            // Check active session before
            const active: ControllerSessionTab = TabsSessionsService.getActive();
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
}

export default (new FileOpenerService());

import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import SidebarSessionsService from './service.sessions.sidebar';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import LayoutStateService from './standalone/service.layout.state';
import { DialogsMultipleFilesActionComponent } from '../components/dialogs/multiplefiles/component';
import PopupsService from './standalone/service.popups';
import { CGuids } from '../states/state.default.sidebar.apps';

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
        const active: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (active === undefined) {
            this._logger.warn(`No active session. Cannot continue with opening file.`);
            return;
        }
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
            return;
        } else if (files.length > 0) {
            // Multiple files
            // Stored panding files
            this._pending = files;
            // Select way: merge or concat
            PopupsService.add({
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
    }

    public openFileByName(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                file: file,
                session: TabsSessionsService.getActive().getGuid(),
            }), IPCMessages.FileOpenResponse).then((response: IPCMessages.FileReadResponse) => {
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
}

export default (new FileOpenerService());

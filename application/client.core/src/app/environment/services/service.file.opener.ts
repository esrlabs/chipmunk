import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import LayoutStateService from './standalone/service.layout.state';
import { DialogsMultipleFilesActionComponent } from '../components/dialogs/multiplefiles/component';
import PopupsService from './standalone/service.popups';
import { SidebarAppMergeFilesComponent } from '../components/sidebar/merge/component';
import { SidebarAppConcatFilesComponent } from '../components/sidebar/concat/component';

export enum EActionType {
    concat = 'concat',
    merging = 'merging',
}

export const CConstTabsGuids = {
    concat: Toolkit.guid(),
    merging: Toolkit.guid(),
};

export const CTabs = {
    [CConstTabsGuids.merging]: { component: SidebarAppMergeFilesComponent, caption: 'Merging', subject: 'onFilesToBeMerged' },
    [CConstTabsGuids.concat]: { component: SidebarAppConcatFilesComponent, caption: 'Concat', subject: 'onFilesToBeConcat' },
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
                    console.log(response.error);
                    // Error message
                }
            }).catch((error: Error) => {
                // Error message
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
        const guid: string = CConstTabsGuids[action];
        const exist: Error | boolean = TabsSessionsService.hasSidebarTab(guid);
        if (exist instanceof Error) {
            return this._logger.error(`Fail to do action "${action}" due error: ${exist.message}`);
        }
        // Show sidebar
        LayoutStateService.sidebarMax();
        // Add or activate tab on sidebar
        if (!exist) {
            TabsSessionsService.addSidebarApp({
                guid: guid,
                name: CTabs[guid].caption,
                closable: true,
                content: {
                    factory: CTabs[guid].component,
                    inputs: {
                        service: this,
                        close: () => {
                            TabsSessionsService.removeSidebarApp(guid);
                        }
                    }
                },
                active: true
            });
        } else {
            TabsSessionsService.openSidebarTab(guid);
        }
        // Trigger event
        this._subjects[CTabs[guid].subject].next(this._pending.slice());
    }
}

export default (new FileOpenerService());

import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import LayoutStateService from './standalone/service.layout.state';

export class FileOpenerService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOpenerService');
    private _pending: File[] = [];
    private _subjects = {
        onFilesToBeMerged: new Subject<File[]>(),
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

    public open(files: File[]) {
        if (files.length === 0) {
            return;
        }
        if (files.length === 1) {
            // Single file
            ServiceElectronIpc.request(new IPCMessages.FileOpenRequest({
                file: (files[0] as any).path,
            }), IPCMessages.FileOpenResponse).then((response: IPCMessages.FileReadResponse) => {
                if (response.error !== undefined) {
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
            // Show sidebar
            LayoutStateService.sidebarMax();
            // Show merge tab
            TabsSessionsService.openSidebarTab('merging');
            // Trigger event
            this._subjects.onFilesToBeMerged.next(this._pending.slice());
        }
    }

    public merge(files: File[]) {
        // Stored panding files
        this._pending = files;
        // Show sidebar
        LayoutStateService.sidebarMax();
        // Show merge tab
        TabsSessionsService.openSidebarTab('merging');
        // Trigger event
        this._subjects.onFilesToBeMerged.next(this._pending.slice());
    }

    public getObservable(): {
        onFilesToBeMerged: Observable<File[]>,
    } {
        return {
            onFilesToBeMerged: this._subjects.onFilesToBeMerged.asObservable(),
        };
    }

    public getMerginPendingFiles(): File[] {
        const pending: File[] = this._pending.slice();
        this._pending = [];
        return pending;
    }

    public dropMerginPendingFiles() {
        this._pending = [];
    }

}

export default (new FileOpenerService());

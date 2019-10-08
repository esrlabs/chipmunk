import { Component, OnDestroy, Input,  ChangeDetectorRef, ViewChildren, QueryList, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import { SidebarAppMergeFilesItemComponent } from './file/component';
import { IFile as ITestResponseFile } from '../../../services/electron.ipc.messages/merge.files.test.response';
import { IFile as IRequestFile } from '../../../services/electron.ipc.messages/merge.files.request';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import SessionsService from '../../../services/service.sessions.tabs';
import EventsHubService from '../../../services/standalone/service.eventshub';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import { IServices, IFile } from '../../../services/shared.services.sidebar';

declare var Electron: any;

interface IFilePreview {
    size: number;
    preview: string;
}

interface IFileItem {
    file: string;
    name: string;
    parser: string;
    preview: string;
    size: number;
    defaultFormat: string;
}

enum EMergeButtonTitle {
    merge = 'Merge',
    confirm = 'Merge with warnings'
}

interface IState {
    _ng_busy: boolean;
    _ng_mergeButtonTitle: EMergeButtonTitle;
    _files: IFileItem[];
    _zones: string[];
}

@Component({
    selector: 'app-sidebar-app-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public static StateKey = 'side-bar-merge-view';

    @Input() public services: IServices;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public close: () => void;

    @ViewChildren(SidebarAppMergeFilesItemComponent) private _filesComps: QueryList<SidebarAppMergeFilesItemComponent>;

    public _ng_busy: boolean = false;
    public _ng_mergeButtonTitle: EMergeButtonTitle = EMergeButtonTitle.merge;
    public _ng_extendSub: Subject<string> = new Subject<string>();
    public _ng_extendObs: Observable<string> = this._ng_extendSub.asObservable();
    public _ng_session: ControllerSessionTab | undefined;

    private _files: IFileItem[] = [];
    private _zones: string[] = [];
    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppMergeFilesComponent');
    private _errors: { [key: string]: boolean } = {};
    private _warnings: { [key: string]: boolean } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._ng_session = SessionsService.getActive();
        this._subscriptions.onSessionChange = SessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.onFilesToBeMerged = this.services.FileOpenerService.getObservable().onFilesToBeMerged.subscribe(this._onFilesToBeMerged.bind(this));
    }

    public ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop.getObservable().onFiles.subscribe(this._onFilesDropped.bind(this));
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove.asObservable().subscribe(this._onBeforeTabRemove.bind(this));
        this._loadState();
    }

    public _ng_onFileRemove(file: string) {
        let index: number = -1;
        this._files.forEach((item, i) => {
            if (item.file === file) {
                index = i;
            }
        });
        if (index === -1) {
            return;
        }
        this._files.splice(index, 1);
        delete this._errors[file];
        delete this._warnings[file];
        this._dropWarnings();
        this._forceUpdate();
    }

    public _ng_onFileFieldUpdated(file: string, warn: boolean, err: boolean) {
        if (warn) {
            this._warnings[file] = true;
        } else {
            delete this._warnings[file];
        }
        if (err) {
            this._errors[file] = true;
        } else {
            delete this._errors[file];
        }
    }

    public _ng_onAddFile() {
        this._dropWarnings();
        this._forceUpdate();
        Electron.remote.dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles']
        }, (files: string[]) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            this._getFileInfo(files[0]).then(() => {
                this._forceUpdate();
            }).catch((error: Error) => {
                this._notifications.add({ caption: 'Merging', message: error.message, options: { type: ENotificationType.error }});
                this._forceUpdate();
            });
        });
    }

    public _ng_onMerge() {
        this._forceFilesState();
        if (this._hasErrors()) {
            this._notifications.add({ caption: 'Merging', message: `Please check fields, some of your file setting has an error`, options: { type: ENotificationType.warning }});
            return;
        }
        this._ng_busy = true;
        this._disable(true);
        this._forceUpdate();
        const files: IRequestFile[] = this._getListOfFiles();
        EventsHubService.getSubject().onKeepScrollPrevent.next();
        ElectronIpcService.request(new IPCMessages.MergeFilesRequest({
            files: files,
            id: Toolkit.guid(),
            session: this._ng_session.getGuid(),
        }), IPCMessages.MergeFilesResponse).then((response: IPCMessages.MergeFilesResponse) => {
            this._ng_busy = false;
            if (typeof response.error === 'string' && response.error.trim() !== '') {
                this._notifications.add({ caption: 'Merging', message: response.error, options: { type: ENotificationType.error }});
                this._disable(false);
                return this._forceUpdate();
            }
            this._files = [];
            this._notifications.add({ caption: 'Merging', message: `Files were merged. Written ${(response.written / 1024 / 1024).toFixed(2)} Mb`, options: { type: ENotificationType.info }});
            this.close();
        }).catch((testError: Error) => {
            this._notifications.add({ caption: 'Merging', message: testError.message, options: { type: ENotificationType.error }});
            this._ng_busy = false;
            this._disable(false);
            this._forceUpdate();
        });
    }

    public _ng_onFileTest(file: string) {
        const comp: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(file);
        if (comp === undefined) {
            return;
        }
        comp.refresh();
        if (!comp.isValid()) {
            return;
        }
        comp.dropTestResults();
        this._ng_onTest({
            file: comp.getFile(),
            parser: comp.getParser(),
            offset: comp.getOffset(),
            zone: comp.getTimezone(),
            format: comp.getFormat(),
            year: comp.getYear(),
        });
    }

    public _ng_onTest(file?: IRequestFile) {
        if (this._hasErrors() && file === undefined) {
            this._notifications.add({ caption: 'Merging', message: `Please check fields, some of your file setting has an error`, options: { type: ENotificationType.warning }});
            return;
        }
        this._ng_busy = true;
        this._disable(true);
        if (file === undefined) {
            this._dropTestResults();
        }
        this._dropWarnings();
        this._forceUpdate();
        ElectronIpcService.request(new IPCMessages.MergeFilesTestRequest({
            files: file === undefined ? this._getListOfFiles() : [file],
            id: Toolkit.guid(),
        }), IPCMessages.MergeFilesTestResponse).then((response: IPCMessages.MergeFilesTestResponse) => {
            this._ng_busy = false;
            this._disable(false);
            this._setTestResults(response.files);
            this._forceUpdate();
        }).catch((testError: Error) => {
            this._notifications.add({ caption: 'Merging', message: testError.message, options: { type: ENotificationType.error }});
            this._ng_busy = false;
            this._disable(false);
            this._forceUpdate();
        });
    }

    public _ng_onDetect() {
        if (this._files.length === 0) {
            return;
        }
        this._ng_busy = true;
        this._disable(true);
        this._forceUpdate();
        ElectronIpcService.request(new IPCMessages.MergeFilesDiscoverRequest({
            files: this._files.map((file: IFileItem) => {
                return file.file;
            }),
            id: Toolkit.guid(),
        }), IPCMessages.MergeFilesDiscoverResponse).then((response: IPCMessages.MergeFilesDiscoverResponse) => {
            this._ng_busy = false;
            this._disable(false);
            this._setDiscoverResults(response.files);
            this._forceUpdate();
        }).catch((testError: Error) => {
            this._notifications.add({ caption: 'Merging', message: testError.message, options: { type: ENotificationType.error }});
            this._ng_busy = false;
            this._disable(false);
            this._forceUpdate();
        });
    }

    private _onBeforeTabRemove() {
        this._dropState();
        this._ng_session.getSessionsStates().drop(this._getStateGuid());
    }

    private _loadState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        if (!this._ng_session.getSessionsStates().applyStateTo(this._getStateGuid(), this)) {
            this._getZones().catch((error: Error) => {
                this._logger.warn(`Fail init timezones due error: ${error.message}`);
            });
        }
        this._onFilesToBeMerged(this.services.FileOpenerService.getPendingFiles());
    }

    private _saveState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        this._files = this._files.map((file: IFileItem) => {
            const comp: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(file.file);
            const format: string | undefined = comp === undefined ? undefined : comp.getFormat();
            if (format !== undefined) {
                file.defaultFormat = format;
            }
            return file;
        });
        this._ng_session.getSessionsStates().set<IState>(
            this._getStateGuid(),
            {
                _ng_busy: this._ng_busy,
                _ng_mergeButtonTitle: this._ng_mergeButtonTitle,
                _files: this._files,
                _zones: this._zones
            }
        );
    }

    private _dropState(): void {
        this._ng_busy = false;
        this._ng_mergeButtonTitle = EMergeButtonTitle.merge;
        this._files = [];
        this._zones = [];
    }

    private _getStateGuid(): string {
        return `${SidebarAppMergeFilesComponent.StateKey}:${this._ng_session.getGuid()}`;
    }

    private _onSessionChange(session: ControllerSessionTab) {
        // Save previos
        this._saveState();
        // Drop state before
        this._dropState();
        // Change session
        this._ng_session = session;
        if (session !== undefined) {
            // Try to load
            this._loadState();
        }
        // Update
        this._forceUpdate();
    }

    private _getZones(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.MergeFilesTimezonesRequest(), IPCMessages.MergeFilestimezoneResponse).then((response: IPCMessages.MergeFilestimezoneResponse) => {
                this._zones = response.zones;
                resolve();
            }).catch((error: Error) => {
                this._notifications.add({ caption: 'Merging', message: `Cannot delivery timezones due error: ${error.message}`, options: { type: ENotificationType.error }});
                this._zones = [];
                reject(error);
            });
        });
    }

    private _onFilesDropped(files: IFile[]) {
        this.services.FileOpenerService.merge(files);
    }

    private _onFilesToBeMerged(files: IFile[]) {
        this.services.FileOpenerService.dropPendingFiles();
        if (files.length === 0) {
            return;
        }
        Promise.all(files.map((file: IFile) => {
            return this._getFileInfo(file.path);
        })).then(() => {
            this._forceUpdate();
            // Try to make auto detection
            this._ng_onDetect();
        }).catch((error: Error) => {
            this._notifications.add({ caption: 'Merging', message: error.message, options: { type: ENotificationType.error }});
            this._forceUpdate();
        });
    }

    private _getFileInfo(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._doesExist(path)) {
                return reject(new Error('This file is already added.'));
            }
            this._getFileStats(path).then((stats: IPCMessages.FileInfoResponse) => {
                this._getFileContent(path).then((preview: IFilePreview) => {
                    this._files.push({
                        file: stats.path,
                        name: stats.name,
                        parser: stats.parser,
                        size: stats.size,
                        preview: preview.preview,
                        defaultFormat: this._files.length === 0 ? undefined : this._getDefaultFormat()
                    });
                    resolve();
                }).catch((previewError: Error) => {
                    reject(`Fail read preview of file due error: ${previewError.message}`);
                });
            }).catch((parserError: Error) => {
                reject(`Fail detect file parser due error: ${parserError.message}`);
            });
        });
    }

    private _getDefaultFormat(): string | undefined {
        if (this._files.length === 0) {
            return undefined;
        }
        const component: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(this._files[this._files.length - 1].file);
        if (component === undefined) {
            return undefined;
        }
        if (component.hasWarnings() || !component.isValid()) {
            return undefined;
        }
        return component.getFormat();
    }

    private _getListOfFiles(): IRequestFile[] {
        return this._filesComps.map((com: SidebarAppMergeFilesItemComponent) => {
            return {
                file: com.getFile(),
                parser: com.getParser(),
                offset: com.getOffset(),
                zone: com.getTimezone(),
                format: com.getFormat(),
                year: com.getYear(),
            };
        });
    }

    private _hasErrors(): boolean {
        return Object.keys(this._errors).length > 0;
    }

    private _dropWarnings() {
        this._ng_mergeButtonTitle = EMergeButtonTitle.merge;
        this._forceUpdate();
    }

    private _forceFilesState() {
        this._filesComps.forEach((com: SidebarAppMergeFilesItemComponent) => {
            com.refresh();
        });
    }

    private _getFileComp(file: string): SidebarAppMergeFilesItemComponent | undefined {
        let component: SidebarAppMergeFilesItemComponent | undefined;
        this._filesComps.forEach((com: SidebarAppMergeFilesItemComponent) => {
            if (component !== undefined) {
                return;
            }
            if (com.getFile() === file) {
                component = com;
            }
        });
        return component;
    }

    private _doesExist(file: string): boolean {
        let result: boolean = false;
        this._files.forEach((item) => {
            if (item.file === file) {
                result = true;
            }
        });
        return result;
    }

    private _setTestResults(files: ITestResponseFile[]) {
        files.forEach((file: ITestResponseFile) => {
            const component: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(file.file);
            if (component === undefined) {
                return;
            }
            component.setTestResults(file);
        });
    }

    private _setDiscoverResults(files: IPCMessages.IMergeFilesDiscoverResult[]) {
        files.forEach((file: IPCMessages.IMergeFilesDiscoverResult) => {
            file.format = typeof file.format === 'string' ? file.format : '';
            if (file.error !== undefined || file.format.trim() === '') {
                return;
            }
            const comp: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(file.path);
            if (comp === undefined) {
                return;
            }
            comp.setFormat(typeof file.format === 'string' ? file.format : '');
        });
    }

    private _dropTestResults() {
        this._files.forEach((item) => {
            const comp: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(item.file);
            if (comp === undefined) {
                return;
            }
            comp.dropTestResults();
        });
    }

    private _disable(disabled: boolean) {
        this._files.forEach((item) => {
            const comp: SidebarAppMergeFilesItemComponent | undefined = this._getFileComp(item.file);
            if (comp === undefined) {
                return;
            }
            if (disabled) {
                comp.disable();
            } else {
                comp.enable();
            }
        });
    }

    private _getFileStats(file: string): Promise<IPCMessages.FileInfoResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FileInfoRequest({
                file: file,
            }), IPCMessages.FileInfoResponse).then((stats: IPCMessages.FileInfoResponse) => {
                if (stats.parser === undefined) {
                    return reject(new Error('Fail to find parser for selected file.'));
                }
                resolve(stats);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _getFileContent(file: string): Promise<IFilePreview> {
        return new Promise((resolve, reject) => {
            if (this._ng_session === undefined) {
                return reject(new Error(this._logger.error(`Session object isn't available`)));
            }
            ElectronIpcService.request(new IPCMessages.FileReadRequest({
                file: file,
                bytes: 25000,
                session: this._ng_session.getGuid()
            }), IPCMessages.FileReadResponse).then((response: IPCMessages.FileReadResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                resolve({ size: response.size, preview: response.content });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

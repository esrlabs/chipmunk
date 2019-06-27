import { Component, OnDestroy, ChangeDetectorRef, ViewChildren, QueryList, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import { SidebarAppMergeFilesItemComponent } from './file/component';
import { IFile as ITestResponseFile } from '../../../services/electron.ipc.messages/merge.files.test.response';
import { IFile as IRequestFile } from '../../../services/electron.ipc.messages/merge.files.request';
import FileOpenerService from '../../../services/service.file.opener';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import SessionsService from '../../../services/service.sessions.tabs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';

declare var Electron: any;

interface IFileInfo {
    parser: string;
    shortname: string;
}

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
    _ng_error: string | undefined;
    _ng_report: string | undefined;
    _ng_busy: boolean;
    _ng_warning: string | undefined;
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

    @ViewChildren(SidebarAppMergeFilesItemComponent) private _filesComps: QueryList<SidebarAppMergeFilesItemComponent>;

    public _ng_error: string | undefined;
    public _ng_report: string | undefined;
    public _ng_busy: boolean = false;
    public _ng_warning: string | undefined;
    public _ng_mergeButtonTitle: EMergeButtonTitle = EMergeButtonTitle.merge;
    public _ng_extendSub: Subject<string> = new Subject<string>();
    public _ng_extendObs: Observable<string> = this._ng_extendSub.asObservable();

    private _files: IFileItem[] = [];
    private _zones: string[] = [];
    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _session: ControllerSessionTab;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppMergeFilesComponent');

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._session = SessionsService.getActive();
        this._subscriptions.onFilesToBeMerged = FileOpenerService.getObservable().onFilesToBeMerged.subscribe(this._onFilesToBeMerged.bind(this));
        this._subscriptions.onSessionChange = SessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public ngOnDestroy() {
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        if (this._ng_error !== undefined) {
            this._cdRef.detectChanges();
        }
    }

    public ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop.getObservable().onFiles.subscribe(this._onFilesDropped.bind(this));
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
        this._dropWarnings();
        this._cdRef.detectChanges();
    }

    public _ng_onFileFieldUpdated(file: string) {
        this._setWarnings();
        this._validate();
    }

    public _ng_onAddFile() {
        this._ng_error = undefined;
        this._ng_report = undefined;
        this._dropWarnings();
        this._cdRef.detectChanges();
        Electron.remote.dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles']
        }, (files: string[]) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            this._openFile(files[0]);
        });
    }

    public _ng_onMerge() {
        if (!this._validate()) {
            return;
        }
        const hasWarnings: boolean = this._hasWarnings();
        this._setWarnings();
        if (!hasWarnings && this._hasWarnings()) {
            // Wait for confirmation
            return;
        }
        this._ng_busy = true;
        this._disable(true);
        this._cdRef.detectChanges();
        const files: IRequestFile[] = this._getListOfFiles();
        ElectronIpcService.request(new IPCMessages.MergeFilesRequest({
            files: files,
            id: Toolkit.guid(),
        }), IPCMessages.MergeFilesResponse).then((response: IPCMessages.MergeFilesResponse) => {
            this._ng_busy = false;
            if (typeof response.error === 'string' && response.error.trim() !== '') {
                this._ng_error = response.error;
                this._disable(false);
                return this._cdRef.detectChanges();
            }
            this._files = [];
            this._ng_report = `Files were merged. Written ${(response.written / 1024 / 1024).toFixed(2)} Mb`;
            this._ng_error = undefined;
            this._ng_warning = undefined;
            this._cdRef.detectChanges();
        }).catch((testError: Error) => {
            this._ng_error = testError.message;
            this._ng_warning = undefined;
            this._ng_report = undefined;
            this._ng_busy = false;
            this._disable(false);
            this._cdRef.detectChanges();
        });
        // DD-MM-YYYY hh:mm:ss.s
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
        if (!this._validate() && file === undefined) {
            return;
        }
        this._ng_busy = true;
        this._disable(true);
        if (file === undefined) {
            this._dropTestResults();
        }
        this._dropWarnings();
        this._cdRef.detectChanges();
        ElectronIpcService.request(new IPCMessages.MergeFilesTestRequest({
            files: file === undefined ? this._getListOfFiles() : [file],
            id: Toolkit.guid(),
        }), IPCMessages.MergeFilesTestResponse).then((response: IPCMessages.MergeFilesTestResponse) => {
            this._ng_busy = false;
            this._disable(false);
            this._setTestResults(response.files);
            this._cdRef.detectChanges();
        }).catch((testError: Error) => {
            this._ng_error = testError.message;
            this._ng_busy = false;
            this._disable(false);
            this._cdRef.detectChanges();
        });
    }

    private _loadState(): void {
        if (!this._session.getSessionsStates().applyStateTo(this._getStateGuid(), this)) {
            this._getZones().catch((error: Error) => {
                this._logger.warn(`Fail init timezones due error: ${error.message}`);
            });
        }
        this._onFilesToBeMerged(FileOpenerService.getMerginPendingFiles());
    }

    private _saveState(): void {
        this._session.getSessionsStates().set<IState>(
            this._getStateGuid(),
            {
                _ng_busy: this._ng_busy,
                _ng_error: this._ng_error,
                _ng_mergeButtonTitle: this._ng_mergeButtonTitle,
                _ng_report: this._ng_report,
                _ng_warning: this._ng_warning,
                _files: this._files,
                _zones: this._zones
            }
        );
    }

    private _dropState(): void {
        this._ng_error = undefined;
        this._ng_report = undefined;
        this._ng_busy = false;
        this._ng_warning = undefined;
        this._ng_mergeButtonTitle = EMergeButtonTitle.merge;
        this._files = [];
        this._zones = [];
    }

    private _getStateGuid(): string {
        return `${SidebarAppMergeFilesComponent.StateKey}:${this._session.getGuid()}`;
    }

    private _onSessionChange(session: ControllerSessionTab) {
        // Save previos
        this._saveState();
        // Drop state before
        this._dropState();
        // Change session
        this._session = session;
        // Try to load
        this._loadState();
        // Update
        this._cdRef.detectChanges();
    }

    private _getZones(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.MergeFilesTimezonesRequest(), IPCMessages.MergeFilestimezoneResponse).then((response: IPCMessages.MergeFilestimezoneResponse) => {
                this._zones = response.zones;
                resolve();
            }).catch((error: Error) => {
                this._ng_error = `Cannot delivery timezones due error: ${error.message}`;
                this._zones = [];
                reject(error);
            });
        });
    }

    private _onFilesDropped(files: File[]) {
        FileOpenerService.merge(files);
    }

    private _onFilesToBeMerged(files: File[]) {
        FileOpenerService.dropMerginPendingFiles();
        if (files.length === 0) {
            return;
        }
        files.forEach((file: File) => {
            this._openFile((file as any).path);
        });
    }

    private _openFile(file: string) {
        if (this._doesExist(file)) {
            this._ng_error = 'This file is already added.';
            return this._cdRef.detectChanges();
        }
        this._getFileParser(file).then((info: IFileInfo) => {
            this._getFileContent(file).then((preview: IFilePreview) => {
                this._files.push({
                    file: file,
                    name: info.shortname,
                    parser: info.parser,
                    size: preview.size,
                    preview: preview.preview,
                    defaultFormat: this._files.length === 0 ? undefined : this._getDefaultFormat()
                });
                this._cdRef.detectChanges();
            }).catch((previewError: Error) => {
                this._ng_error = `Fail read preview of file due error: ${previewError.message}`;
                this._cdRef.detectChanges();
            });
        }).catch((parserError: Error) => {
            this._ng_error = `Fail detect file parser due error: ${parserError.message}`;
            this._cdRef.detectChanges();
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

    private _validate(): boolean {
        let error: boolean = false;
        this._ng_error = '';
        this._filesComps.forEach((com: SidebarAppMergeFilesItemComponent) => {
            if (!com.isValid()) {
                error = true;
                com.refresh();
            }
        });
        if (error) {
            this._ng_error = `Please check settings of files.`;
        }
        this._cdRef.detectChanges();
        return !error;
    }

    private _hasWarnings(): boolean {
        return this._ng_warning !== undefined;
    }

    private _setWarnings(): void {
        let warning: boolean = false;
        this._filesComps.forEach((com: SidebarAppMergeFilesItemComponent) => {
            if (com.hasWarnings()) {
                warning = true;
                com.refresh();
            }
        });
        if (warning) {
            this._ng_warning = `Something isn't okay with your configuration. Are you sure, you would like to merge?`;
            this._ng_mergeButtonTitle = EMergeButtonTitle.confirm;
        } else {
            this._ng_mergeButtonTitle = EMergeButtonTitle.merge;
            this._ng_warning = undefined;
        }
        this._cdRef.detectChanges();
    }

    private _dropWarnings() {
        this._ng_mergeButtonTitle = EMergeButtonTitle.merge;
        this._ng_warning = undefined;
        this._cdRef.detectChanges();
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

    private _getFileParser(file: string): Promise<IFileInfo> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FileGetParserRequest({
                file: file,
            }), IPCMessages.FileGetParserResponse).then((response: IPCMessages.FileGetParserResponse) => {
                if (response.parser === undefined) {
                    return reject(new Error('Fail to find parser for selected file.'));
                }
                resolve({ parser: response.parser, shortname: response.shortname });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _getFileContent(file: string): Promise<IFilePreview> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FileReadRequest({
                file: file,
                bytes: 50000,
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

    private _getMergeWarning(): string | undefined {
        return undefined;
    }

}

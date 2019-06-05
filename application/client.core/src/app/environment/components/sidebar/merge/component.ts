import { Component, OnDestroy, ChangeDetectorRef, ViewChildren, QueryList, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import { SidebarAppMergeFilesItemComponent } from './file/component';
import { IFile as ITestRequestFile } from '../../../services/electron.ipc.messages/merge.files.test.request';
import { IFile as ITestResponseFile } from '../../../services/electron.ipc.messages/merge.files.test.response';
import { IFile as IRequestFile } from '../../../services/electron.ipc.messages/merge.files.request';


declare var Electron: any;

@Component({
    selector: 'app-sidebar-app-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesComponent implements OnDestroy, AfterContentInit {

    @ViewChildren(SidebarAppMergeFilesItemComponent) private _filesComps: QueryList<SidebarAppMergeFilesItemComponent>;

    public _ng_error: string | undefined;
    public _ng_report: string | undefined;
    public _ng_busy: boolean = false;

    private _files: Array<{ file: string; name: string, parser: string }> = [];
    private _zones: string[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {
        ElectronIpcService.request(new IPCMessages.MergeFilesTimezonesRequest(), IPCMessages.MergeFilestimezoneResponse).then((response: IPCMessages.MergeFilestimezoneResponse) => {
            this._zones = response.zones;
        }).catch((error: Error) => {
            this._ng_error = `Cannot delivery timezones due error: ${error.message}`;
        });
    }

    public ngOnDestroy() {
    }

    public ngAfterContentInit() {
        if (this._ng_error !== undefined) {
            this._cdRef.detectChanges();
        }
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
        this._cdRef.detectChanges();
    }

    public _ng_onAddFile() {
        this._ng_error = undefined;
        this._ng_report = undefined;
        this._cdRef.detectChanges();
        Electron.remote.dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles']
        }, (files: string[]) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            if (this._doesExist(files[0])) {
                this._ng_error = 'This file is already added.';
                return this._cdRef.detectChanges();
            }
            ElectronIpcService.request(new IPCMessages.FileGetParserRequest({
                file: files[0],
            }), IPCMessages.FileGetParserResponse).then((response: IPCMessages.FileGetParserResponse) => {
                if (response.parser === undefined) {
                    this._ng_error = `Fail to find parser for selected file.`;
                } else {
                    this._files.push({ file: files[0], name: response.shortname, parser: response.parser });
                }
                this._cdRef.detectChanges();
            }).catch((error: Error) => {
                this._ng_error = `Fail detect file parser due error: ${error.message}`;
                this._cdRef.detectChanges();
            });
        });
    }

    public _ng_onMerge() {
        if (!this._validate()) {
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
            this._cdRef.detectChanges();
        }).catch((testError: Error) => {
            this._ng_error = testError.message;
            this._ng_busy = false;
            this._disable(false);
            this._cdRef.detectChanges();
        });
    }

    public _ng_onTest() {
        if (!this._validate()) {
            return;
        }
        this._ng_busy = true;
        this._disable(true);
        this._cdRef.detectChanges();
        const files: IRequestFile[] = this._getListOfFiles();
        ElectronIpcService.request(new IPCMessages.MergeFilesTestRequest({
            files: files,
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
            this._dropTestResults();
            this._cdRef.detectChanges();
        });
    }

    private _getListOfFiles(): IRequestFile[] {
        return this._filesComps.map((com: SidebarAppMergeFilesItemComponent) => {
            return {
                file: com.getFile(),
                reg: '',
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

}

import { Component, ChangeDetectorRef, Input, AfterContentInit, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import FileOpenerService from '../../../services/service.file.opener';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatInput, MatAutocompleteTrigger } from '@angular/material';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-views-dialogs-recentfilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class DialogsRecentFilesActionComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(MatInput, {static: false}) _inputComRef: MatInput;
    @ViewChild(MatAutocompleteTrigger, {static: false}) _autoComRef: MatAutocompleteTrigger;

    public _ng_files: Observable<IPCMessages.IRecentFileInfo[]>;
    public _files: Array<IPCMessages.IRecentFileInfo> = [];
    public _ng_inputCtrl = new FormControl();
    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFilesActionComponent');
    private _destroyed: boolean = false;

    @Input() close: () => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notificationsService: NotificationsService) {
        this._ng_displayWith = this._ng_displayWith.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public ngOnInit() {
        ElectronIpcService.request(new IPCMessages.FilesRecentRequest(), IPCMessages.FilesRecentResponse).then((response: IPCMessages.FilesRecentResponse) => {
            if (response.error !== undefined) {
                this._files = [];
                this._logger.error(`Fail to get list of recent files due error: ${response.error}`);
                this._notificationsService.add({
                    caption: 'Fail load recent files',
                    message: `Fail to load recent files due error: ${response.error}`
                });
            } else {
                this._files = response.files.map((file: IPCMessages.IRecentFileInfo) => {
                    if (file.filename === undefined) {
                        file.filename = Toolkit.basename(file.file);
                    }
                    if (file.folder === undefined) {
                        file.folder = Toolkit.dirname(file.file);
                    }
                    return file;
                });
            }
            this._ng_files = this._ng_inputCtrl.valueChanges.pipe(
                startWith(''),
                map(value => this._filter(value))
            );
            this._ng_files.subscribe(() => {
                this._focus();
            });
        }).catch((error: Error) => {
            this._logger.error(`Fail to get list of recent files due error: ${error}`);
        });
    }

    public ngAfterViewInit() {
        this._focus();
    }

    public _ng_onPanelClosed() {
        this.close();
    }

    public _ng_onFileSelected(file: IPCMessages.IRecentFileInfo) {
        FileOpenerService.openFileByName(file.file).catch((openFileErr: Error) => {
            this._logger.error(`Fail to open new session due error: ${openFileErr.message}`);
            this._notificationsService.add({
                caption: 'Fail open file',
                message: `Fail to open file "${file.file}" due error: ${openFileErr.message}`
            });
        });
        this.close();
    }

    public _ng_displayWith(file: IPCMessages.IRecentFileInfo): string {
        if (file === null || file === undefined) {
            return '';
        }
        return file.filename;
    }

    private _focus() {
        this._forceUpdate();
        if (this._inputComRef === undefined || this._autoComRef === undefined) {
            return;
        }
        this._autoComRef.openPanel();
        this._inputComRef.focus();
    }

    private _filter(value: string): IPCMessages.IRecentFileInfo[] {
        if (typeof value !== 'string') {
            return;
        }
        const filted = value.toLowerCase();
        this._focus();
        return this._files.filter((file: IPCMessages.IRecentFileInfo) => {
            return file.file.includes(filted);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

import {
    Component,
    ChangeDetectorRef,
    Input,
    OnInit,
    OnDestroy,
    ViewChild,
    AfterViewInit,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { Observable } from 'rxjs';
import { sortFiles, ISortedFile } from '../../../thirdparty/code/engine';

import * as Toolkit from 'chipmunk.client.toolkit';

import ElectronIpcService, { IPC } from '../../../services/service.electron.ipc';
import FileOpenerService from '../../../services/service.file.opener';
import FocusOutputService from '../../../services/service.focus.output';

@Component({
    selector: 'app-views-dialogs-recentfilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsRecentFilesActionComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatInput) _inputComRef!: MatInput;
    @ViewChild(MatAutocompleteTrigger) _autoComRef!: MatAutocompleteTrigger;

    public _ng_files!: Observable<ISortedFile[]>;
    public _files: ISortedFile[] = [];
    public _ng_inputCtrl = new FormControl();
    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFilesActionComponent');
    private _destroyed: boolean = false;

    @Input() close: () => void = () => {};

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notificationsService: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {
        this._ng_displayWith = this._ng_displayWith.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        FocusOutputService.focus();
    }

    public ngOnInit() {
        ElectronIpcService.request<IPC.FilesRecentResponse>(
            new IPC.FilesRecentRequest(),
            IPC.FilesRecentResponse,
        )
            .then((response) => {
                if (response.error !== undefined) {
                    this._files = [];
                    this._logger.error(
                        `Fail to get list of recent files due error: ${response.error}`,
                    );
                    this._notificationsService.add({
                        caption: 'Fail load recent files',
                        message: `Fail to load recent files due error: ${response.error}`,
                    });
                } else {
                    this._files = response.files.map((file: IPC.IRecentFileInfo) => {
                        return {
                            file: file.file,
                            basename: Toolkit.basename(file.file),
                            dirname: Toolkit.dirname(file.file),
                            tbasename: Toolkit.basename(file.file),
                            tdirname: Toolkit.dirname(file.file),
                            size: file.size,
                        };
                    });
                }
                this._ng_files = this._ng_inputCtrl.valueChanges.pipe(
                    startWith(''),
                    map((value) => this._filter(value)),
                );
                this._ng_files.subscribe(() => {
                    this._focus();
                });
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to get list of recent files due error: ${error}`);
            });
    }

    public ngAfterViewInit() {
        this._focus();
    }

    public _ng_onPanelClosed() {
        this.close();
    }

    public _ng_onFileSelected(file: IPC.IRecentFileInfo) {
        FileOpenerService.openFileByName(file.file).catch((openFileErr: Error) => {
            this._logger.error(`Fail to open new session due error: ${openFileErr.message}`);
            this._notificationsService.add({
                caption: 'Fail open file',
                message: `Fail to open file "${file.file}" due error: ${openFileErr.message}`,
            });
        });
        this.close();
    }

    public _ng_displayWith(file: ISortedFile): string {
        if (file === null || file === undefined) {
            return '';
        }
        return file.basename;
    }

    public _ng_getSafeHTML(str: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(str);
    }

    private _focus() {
        this._forceUpdate();
        if (this._inputComRef === undefined || this._autoComRef === undefined) {
            return;
        }
        this._autoComRef.openPanel();
        this._inputComRef.focus();
    }

    private _filter(value: string): ISortedFile[] {
        if (typeof value !== 'string') {
            return [];
        }
        const scored = sortFiles(this._files, value, value !== '', 'span');
        this._focus();
        return scored;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

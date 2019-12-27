import { Component, ChangeDetectorRef, Input, OnDestroy, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatInput, MatAutocompleteTrigger } from '@angular/material';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-views-dialogs-recentfilters-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsRecentFitlersActionComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(MatInput, {static: false}) _inputComRef: MatInput;
    @ViewChild(MatAutocompleteTrigger, {static: false}) _autoComRef: MatAutocompleteTrigger;

    public _ng_files: Observable<IPCMessages.IRecentFilterFileInfo[]>;
    public _files: Array<IPCMessages.IRecentFilterFileInfo> = [];
    public _ng_inputCtrl = new FormControl();
    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFitlersActionComponent');
    private _destroyed: boolean = false;

    @Input() close: () => void = () => {};
    @Input() open: (file: string) => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notificationsService: NotificationsService) {
        this._ng_displayWith = this._ng_displayWith.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public ngOnInit() {
        ElectronIpcService.request(new IPCMessages.FiltersFilesRecentRequest(), IPCMessages.FiltersFilesRecentResponse).then((response: IPCMessages.FiltersFilesRecentResponse) => {
            if (response.error) {
                this._files = [];
                this._notificationsService.add({
                    caption: 'Fail load recent filters',
                    message: `Fail to load recent filters due error: ${response.error}`
                });
                this._logger.warn(`Fail to load recent files due error: ${response.error}`);
            } else {
                this._files = response.files.map((file: IPCMessages.IRecentFilterFileInfo) => {
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
            this._logger.warn(`Fail to load recent files due error: ${error.message}`);
            this._notificationsService.add({
                caption: 'Fail load recent filters',
                message: `Fail to load recent files due error: ${error.message}`
            });
        });
    }

    public ngAfterViewInit() {
        this._focus();
    }

    public _ng_onPanelClosed() {
        this.close();
    }

    public _ng_onFileSelected(file: IPCMessages.IRecentFilterFileInfo) {
        this.open(file.file);
        this.close();
    }

    public _ng_displayWith(file: IPCMessages.IRecentFilterFileInfo): string {
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

    private _filter(value: string): IPCMessages.IRecentFilterFileInfo[] {
        if (typeof value !== 'string') {
            return;
        }
        const filted = value.toLowerCase();
        this._focus();
        return this._files.filter((file: IPCMessages.IRecentFilterFileInfo) => {
            return file.file.includes(filted);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
/*
    public _ng_files: Array<IPCMessages.IRecentFilterFileInfo> = [];
    public _files: Array<IPCMessages.IRecentFilterFileInfo> = [];

    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFilesActionComponent');

    @Input() close: () => void = () => {};
    @Input() open: (file: string) => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._ng_onFilterChange = this._ng_onFilterChange.bind(this);
    }

    public ngAfterContentInit() {

    }

    public _ng_open(file: IPCMessages.IRecentFilterFileInfo) {
        this.open(file.file);
        this.close();
    }

    public _ng_getLocalTime(timestamp: number) {
        const date: Date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    public _ng_onFilterChange(value: string, event: KeyboardEvent) {
        const reg: RegExp | Error = Toolkit.regTools.createFromStr(value);
        if (reg instanceof Error) {
            this._ng_files = this._files.slice();
            this._cdRef.detectChanges();
            return;
        }
        this._ng_files = this._files.filter((file: IPCMessages.IRecentFilterFileInfo) => {
            return file.filename.search(reg) !== -1 || file.folder.search(reg) !== -1;
        });
        this._cdRef.detectChanges();
    }
*/
}

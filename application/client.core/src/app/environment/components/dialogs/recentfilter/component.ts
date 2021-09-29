import {
    Component,
    ChangeDetectorRef,
    Input,
    OnDestroy,
    OnInit,
    AfterViewInit,
    ViewChild,
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

@Component({
    selector: 'app-views-dialogs-recentfilters-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsRecentFitlersActionComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatInput) _inputComRef!: MatInput;
    @ViewChild(MatAutocompleteTrigger) _autoComRef!: MatAutocompleteTrigger;

    public _ng_files!: Observable<ISortedFile[]>;
    public _files: Array<ISortedFile> = [];
    public _ng_inputCtrl = new FormControl();
    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFitlersActionComponent');
    private _destroyed: boolean = false;

    @Input() close: () => void = () => {};
    @Input() open: (file: string) => void = () => {};

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notificationsService: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {
        this._ng_displayWith = this._ng_displayWith.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public ngOnInit() {
        ElectronIpcService.request<IPC.FiltersFilesRecentResponse>(
            new IPC.FiltersFilesRecentRequest(),
            IPC.FiltersFilesRecentResponse,
        )
            .then((response) => {
                if (response.error) {
                    this._files = [];
                    this._notificationsService.add({
                        caption: 'Fail load recent filters',
                        message: `Fail to load recent filters due error: ${response.error}`,
                    });
                    this._logger.warn(`Fail to load recent files due error: ${response.error}`);
                } else {
                    this._files = response.files.map((file: IPC.IRecentFilterFileInfo) => {
                        return {
                            file: file.file,
                            basename: Toolkit.basename(file.file),
                            dirname: Toolkit.dirname(file.file),
                            tbasename: Toolkit.basename(file.file),
                            tdirname: Toolkit.dirname(file.file),
                            filters: file.count,
                            timestamp: file.timestamp,
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
                this._logger.warn(`Fail to load recent files due error: ${error.message}`);
                this._notificationsService.add({
                    caption: 'Fail load recent filters',
                    message: `Fail to load recent files due error: ${error.message}`,
                });
            });
    }

    public ngAfterViewInit() {
        this._focus();
    }

    public _ng_onPanelClosed() {
        this.close();
    }

    public _ng_onFileSelected(file: IPC.IRecentFilterFileInfo) {
        this.open(file.file);
        this.close();
    }

    public _ng_displayWith(file: IPC.IRecentFilterFileInfo): string {
        if (file === null || file === undefined) {
            return '';
        }
        return file.filename;
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

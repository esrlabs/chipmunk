import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPCMessages, Subscription } from '../../../services/service.electron.ipc';
import { NotificationsService, INotification } from '../../../services.injectable/injectable.service.notifications';

@Component({
    selector: 'app-views-dialogs-recentfilters-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsRecentFitlersActionComponent implements AfterContentInit {

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
        ElectronIpcService.request(new IPCMessages.FiltersFilesRecentRequest(), IPCMessages.FiltersFilesRecentResponse).then((message: IPCMessages.FiltersFilesRecentResponse) => {
            if (message.error) {
                this._notifications.add({
                    caption: 'Fail load recent filters',
                    message: `Fail to load recent files due error: ${message.error}`
                });
                this._logger.warn(`Fail to load recent files due error: ${message.error}`);
                return;
            }
            this._ng_files = message.files;
            this._files = message.files.slice();
            this._cdRef.detectChanges();
        }).catch((error: Error) => {
            this._logger.warn(`Fail to load recent files due error: ${error.message}`);
            this._notifications.add({
                caption: 'Fail load recent filters',
                message: `Fail to load recent files due error: ${error.message}`
            });
        });
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

}

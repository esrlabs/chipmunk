import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import ElectronIpcService, { IPCMessages, Subscription } from '../../../services/service.electron.ipc';
import { NotificationsService, INotification } from '../../../services.injectable/injectable.service.notifications';

@Component({
    selector: 'app-views-dialogs-recentfilters-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsRecentFitlersActionComponent implements AfterContentInit {

    public _ng_files: Array<IPCMessages.IRecentFilterFileInfo> = [];

    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFilesActionComponent');

    @Input() close: () => void = () => {};
    @Input() open: (file: string) => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
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

}

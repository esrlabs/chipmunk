import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPCMessages, Subscription } from '../../../services/service.electron.ipc';
import FileOpenerService from '../../../services/service.file.opener';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { NotificationsService, INotification } from '../../../services.injectable/injectable.service.notifications';

@Component({
    selector: 'app-views-dialogs-recentfilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsRecentFilesActionComponent implements AfterContentInit {

    public _ng_files: Array<IPCMessages.IRecentFileInfo> = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsRecentFilesActionComponent');

    @Input() close: () => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notificationsService: NotificationsService) {
    }

    public ngAfterContentInit() {
        ElectronIpcService.request(new IPCMessages.FilesRecentRequest(), IPCMessages.FilesRecentResponse).then((response: IPCMessages.FilesRecentResponse) => {
            if (response.error !== undefined) {
                this._logger.error(`Fail to get list of recent files due error: ${response.error}`);
                return;
            }
            this._ng_files = response.files.map((file: IPCMessages.IRecentFileInfo) => {
                if (file.filename === undefined) {
                    file.filename = Toolkit.basename(file.file);
                }
                if (file.folder === undefined) {
                    file.folder = Toolkit.dirname(file.file);
                }
                return file;
            });
            this._cdRef.detectChanges();
        }).catch((error: Error) => {
            this._logger.error(`Fail to get list of recent files due error: ${error}`);
        });
    }

    public _ng_open(file: IPCMessages.IRecentFileInfo) {
        TabsSessionsService.add().then(() => {
            FileOpenerService.openFileByName(file.file).catch((openFileErr: Error) => {
                this._logger.error(`Fail to open new session due error: ${openFileErr.message}`);
                this._notificationsService.add({
                    caption: 'Fail open file',
                    message: `Fail to open file "${file.file}" due error: ${openFileErr.message}`
                });
            });
        }).catch((addSessionErr: Error) => {
            this._logger.error(`Fail to open new session due error: ${addSessionErr.message}`);
            this._notificationsService.add({
                caption: 'Fail open file',
                message: `Fail to open file "${file.file}" due error: ${addSessionErr.message}`
            });
        });

        this.close();
    }

    public _ng_getLocalTime(timestamp: number) {
        const date: Date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

}
